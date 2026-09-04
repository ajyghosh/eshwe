"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { syncCustomerDisplayName, getCustomerAuthDisplayLabel } from "@/lib/auth";
import { formatCurrency } from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { useFavorites } from "@/components/favorites-provider";
import { MobileAppShell } from "@/components/mobile-app-shell";
import { NotifyWaitlistDialog } from "@/components/notify-waitlist-dialog";
import { subscribeToCategoryCards, subscribeToHomePageContent } from "@/lib/homepage";
import {
  compareProductsByAvailability,
  getPurchasableQuantityLimit,
  isCartItemUnavailable,
  isProductPurchasable
} from "@/lib/inventory";
import {
  formatOrderConfirmationId,
  formatOrderConfirmationDateOnly,
  formatOrderConfirmationPaymentStatus,
  openOrderReceiptPreview,
  readLatestOrderConfirmation,
  saveLatestOrderConfirmation,
  type OrderConfirmationData
} from "@/lib/order-confirmation";
import { buildReorderSelections, subscribeToCustomerOrders } from "@/lib/orders";
import {
  defaultDryingTips,
  defaultProductLength,
  defaultProductNote,
  defaultSareeCareTips,
  defaultWashCare
} from "@/lib/product-detail-defaults";
import {
  getRazorpayApiUrl,
  loadRazorpayCheckoutScript,
  type RazorpayCheckoutOptions,
  type RazorpayEventResponse,
  type RazorpayHandlerResponse
} from "@/lib/razorpay";
import { buildProtectedJsonHeadersForPath } from "@/lib/protected-request";
import { getProductDiscoveryTags, matchesProductIntent, matchesProductSearch } from "@/lib/product-discovery";
import { subscribeToSarees } from "@/lib/sarees";
import {
  buildAppAccountHref,
  buildAppCategoryHref,
  buildAppCheckoutHref,
  buildAppHomeHref,
  buildAppOrdersHref,
  buildAppProductPath,
  buildAppProductHref,
  buildAppSearchVisiblePath,
  buildAppSearchHref
  ,
  resolveAppProductSlug,
  resolveAppSearchState
} from "@/lib/mobile-app-routes";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import { normalizeMobileHomeHeroSlides, type CategoryCard, type HomePageContent } from "@/types/homepage";
import type { CartItem } from "@/types/cart";
import type { CustomerAddress } from "@/types/customer-profile";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

type SearchSort = "relevance" | "newest" | "price-asc" | "price-desc";

type PaymentFormState = {
  address: string;
  city: string;
  email: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
};

type CreateOrderResponse = {
  amount: number;
  currency: string;
  internalOrderId: string;
  keyId: string;
  lineItems: Array<{
    color?: string;
    name: string;
    primaryImageUrl?: string;
    quantity: number;
    sku: string;
    unitOriginalPrice?: number | null;
    unitPrice?: number | null;
  }>;
  razorpayOrderId: string;
};

type PaymentOverlayStep = "verifying" | null;

const emptyAddressForm: PaymentFormState = {
  address: "",
  city: "",
  email: "",
  fullName: "",
  phone: "",
  pincode: "",
  state: ""
};

const POPULAR_SEARCHES = ["Mul Cotton", "Kanchi Cotton", "Tissue Silk", "Soft Silk", "Wedding"];
const MOBILE_INTENT_OPTIONS = ["Wedding", "Gifting", "Everyday", "New", "Under ₹2,000"];

export function MobileAppHomePage() {
  const [homeContent, setHomeContent] = useState<HomePageContent | null>(null);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [homeProducts, setHomeProducts] = useState<Saree[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentMobileHeroIndex, setCurrentMobileHeroIndex] = useState(0);
  const { totalItems } = useCart();

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setHomeContent(content);
    });
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards.filter((card) => card.active));
    });
  }, []);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setHomeProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"], max: 18 }
    );
  }, []);

  const newArrivals = useMemo(
    () => sortProducts(homeProducts, "newest", "").slice(0, 12),
    [homeProducts]
  );
  const featuredProducts = useMemo(
    () => sortProducts(homeProducts.filter((product) => product.featured), "newest", "").slice(0, 12),
    [homeProducts]
  );
  const previewProducts = useMemo(() => {
    const seenSkus = new Set<string>();

    return [...featuredProducts, ...newArrivals].filter((product) => {
      if (seenSkus.has(product.sku)) {
        return false;
      }

      seenSkus.add(product.sku);
      return true;
    });
  }, [featuredProducts, newArrivals]);
  const heroProduct = newArrivals[0] ?? null;
  const promiseProduct = newArrivals[1] ?? heroProduct;
  const mobileHeroSlides = useMemo(
    () => normalizeMobileHomeHeroSlides(homeContent?.mobileHeroSlides),
    [homeContent?.mobileHeroSlides]
  );
  const mobileHeroSlideSignature = useMemo(
    () => mobileHeroSlides.map((slide) => `${slide.imageUrl}|${slide.position || "center"}`).join("::"),
    [mobileHeroSlides]
  );
  const resolvedMobileHeroSlides = useMemo(
    () =>
      mobileHeroSlides.length > 0
        ? mobileHeroSlides
        : [
            {
              imageUrl: homeContent?.heroImageUrl || heroProduct?.primaryImageUrl || "",
              position: homeContent?.heroImagePosition || "center"
            }
          ].filter((slide) => slide.imageUrl),
    [heroProduct?.primaryImageUrl, homeContent?.heroImagePosition, homeContent?.heroImageUrl, mobileHeroSlides]
  );
  const activeMobileHeroSlide = resolvedMobileHeroSlides[currentMobileHeroIndex] ?? null;
  const mobileLaunchEyebrow = homeContent?.mobileLaunchEyebrow || homeContent?.launchEyebrow || "Opening Shortly";
  const mobileLaunchHeading =
    homeContent?.mobileLaunchHeading || homeContent?.launchHeading || "Timeless Sarees, thoughtfully yours";
  const mobileLaunchBody =
    homeContent?.mobileLaunchBody ||
    homeContent?.launchBody ||
    "Handpicked drapes in mul cotton, tissue and more. Soft on you, perfect for every occasion.";
  const mobileLaunchButtonLabel = homeContent?.mobileLaunchButtonLabel?.trim() || "SHOP SAREES";
  const mobileLaunchButtonHref = homeContent?.mobileLaunchButtonHref?.trim() || buildAppSearchHref();

  useEffect(() => {
    setCurrentMobileHeroIndex(0);
  }, [mobileHeroSlideSignature]);

  useEffect(() => {
    if (resolvedMobileHeroSlides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentMobileHeroIndex((current) => (current + 1) % resolvedMobileHeroSlides.length);
    }, 4200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [resolvedMobileHeroSlides.length]);

  return (
    <MobileAppShell activeTab="home">
      <div className="px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <MobileHomeHeader totalItems={totalItems} onOpenMenu={() => setMenuOpen(true)} />

        <section className="-mx-4 mt-5">
          <div className="relative overflow-hidden">
            <div
              className="flex aspect-[0.93] transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${currentMobileHeroIndex * 100}%)` }}
            >
              {resolvedMobileHeroSlides.map((slide, index) => (
                <div
                  key={`${slide.imageUrl}-${index}`}
                  className="h-full w-full shrink-0 bg-[#e8dcc8]"
                  style={{
                    ...buildImageBackgroundStyle(slide.imageUrl),
                    backgroundPosition: slide.position || "center"
                  }}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-end p-5 pb-7">
              <div className="max-w-[16.25rem] rounded-[1.5rem] border border-[rgba(243,223,170,0.38)] bg-[linear-gradient(135deg,rgba(255,250,242,0.78)_0%,rgba(251,244,232,0.52)_100%)] px-4 py-4 text-[#354233] shadow-[0_16px_36px_rgba(47,40,32,0.14)] backdrop-blur-[5px]">
                <div className="mb-3 flex items-center gap-3 text-[0.54rem] font-semibold uppercase tracking-[0.22em] text-[#9b885f]">
                  <span>{mobileLaunchEyebrow}</span>
                  <span className="h-px flex-1 bg-[#d7c4a2]" />
                </div>
                <h1 className="brand-copy text-[1.92rem] leading-[1.04] text-[#354233]">
                  {mobileLaunchHeading}
                </h1>
                <p className="mt-3 text-[0.88rem] leading-6 text-[#61705d]">
                  {mobileLaunchBody}
                </p>
                <Link
                  href={mobileLaunchButtonHref}
                  className="brand-caption mt-5 inline-flex items-center justify-center rounded-[0.95rem] bg-[#5e684f] px-4.5 py-3 text-[0.62rem] font-semibold tracking-[0.16em] !text-[#fbf4e8] shadow-[0_12px_26px_rgba(94,104,79,0.2)]"
                >
                  {mobileLaunchButtonLabel}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 px-4 pb-1 pt-4">
            {resolvedMobileHeroSlides.map((_, index) => (
              <button
                key={`mobile-hero-dot-${index}`}
                type="button"
                aria-label={`View slide ${index + 1}`}
                onClick={() => setCurrentMobileHeroIndex(index)}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  index === currentMobileHeroIndex ? "w-6 bg-[#5e684f]" : "w-2.5 bg-[#d6ccb9]"
                }`}
              />
            ))}
          </div>
        </section>

        <div className="mt-3 -mx-1">
          <div className="flex gap-2.5 overflow-x-auto px-1 pb-1 hide-scrollbar">
            {["Wedding", "Gifting", "Everyday", "New", "Under ₹2,000"].map((tag) => (
              <Link
                key={tag}
                href={buildAppSearchHref({ intent: tag })}
                className="shrink-0 rounded-full border border-[#dfd4c4] bg-[#fffaf2] px-3.5 py-2 text-[0.82rem] font-medium text-[#526049]"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>

        <MobileHomeSection
          title="Shop by category"
          actionHref={buildAppSearchHref()}
          actionLabel="View all"
          tone="warm"
          eyebrow="Curated edits"
        >
          <div className="mt-4 grid grid-cols-2 gap-3">
            {categoryCards.slice(0, 6).map((card) => (
              <MobileCategoryCard key={card.id ?? card.title} card={card} products={previewProducts} />
            ))}
          </div>
        </MobileHomeSection>

        <MobileHomeSection
          title="New arrivals"
          actionHref={buildAppSearchHref({ sort: "newest" })}
          actionLabel="View all"
          tone="plain"
          eyebrow="Fresh drops"
        >
          <MobileProductPreviewGrid products={newArrivals} sectionKey="new-arrivals" />
        </MobileHomeSection>

        {featuredProducts.length > 0 ? (
          <MobileHomeSection
            title="Featured products"
            actionHref={buildAppSearchHref({ q: "", sort: "relevance" })}
            actionLabel="View all"
            tone="sage"
            eyebrow="Boutique picks"
          >
            <MobileProductPreviewGrid products={featuredProducts} sectionKey="featured-products" />
          </MobileHomeSection>
        ) : null}

        {promiseProduct ? (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(135deg,#fff9ef_0%,#f7efe1_100%)] shadow-[0_18px_38px_rgba(94,104,79,0.08)]">
            <div className="grid grid-cols-[1fr_0.95fr] items-center gap-4 p-5">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f0e6d8] text-[#758060]">
                  <LeafIcon />
                </span>
                <h2 className="brand-copy mt-4 text-[1.85rem] leading-tight text-[#2f342d]">Our promise</h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-[#657260]">
                  Every saree is chosen for exceptional quality, soft comfort, and timeless beauty.
                </p>
              </div>
              <div
                className="aspect-[0.96] rounded-[1.5rem] bg-[#e8dcc8]"
                style={buildImageBackgroundStyle(promiseProduct.primaryImageUrl)}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-[1.35rem] border border-[#eadfce] bg-white/84 px-2 py-2 shadow-[0_8px_18px_rgba(94,104,79,0.04)]">
          <div className="grid grid-cols-3 gap-1.5">
            <SimpleTrustPill title="Free Shipping" icon={<TruckIcon />} />
            <SimpleTrustPill title="Secure Payments" icon={<ShieldIcon />} />
            <SimpleTrustPill title="Quality Assured" icon={<LeafIcon />} />
          </div>
        </section>
      </div>

      <MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} categoryCards={categoryCards} />
    </MobileAppShell>
  );
}

export function MobileAppSearchPage({ categoryFirst = false }: { categoryFirst?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/app/search";
  const searchParams = useSearchParams();
  const currentSearchParams = searchParams ?? new URLSearchParams();
  const resolvedSearchState = useMemo(
    () =>
      resolveAppSearchState(pathname, {
        category: currentSearchParams.get("category") ?? "",
        fabric: currentSearchParams.get("fabric") ?? "",
        intent: currentSearchParams.get("intent") ?? "",
        q: currentSearchParams.get("q") ?? "",
        sort: currentSearchParams.get("sort") ?? ""
      }),
    [currentSearchParams, pathname]
  );
  const [products, setProducts] = useState<Saree[]>([]);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(resolvedSearchState.q ?? "");
  const [draftCategory, setDraftCategory] = useState(resolvedSearchState.category ?? "");
  const [draftFabric, setDraftFabric] = useState(resolvedSearchState.fabric ?? "");
  const [draftIntent, setDraftIntent] = useState(resolvedSearchState.intent ?? "");
  const [draftSort, setDraftSort] = useState<SearchSort>(normalizeSortValue(resolvedSearchState.sort ?? null));
  const activeCategory = resolvedSearchState.category ?? "";
  const activeFabric = resolvedSearchState.fabric ?? "";
  const activeIntent = resolvedSearchState.intent ?? "";
  const activeQuery = resolvedSearchState.q ?? "";
  const activeSort = normalizeSortValue(resolvedSearchState.sort ?? null);
  useEffect(() => {
    setSearchValue(activeQuery);
    setDraftCategory(activeCategory);
    setDraftFabric(activeFabric);
    setDraftIntent(activeIntent);
    setDraftSort(activeSort);
  }, [activeCategory, activeFabric, activeIntent, activeQuery, activeSort]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = `${buildAppSearchVisiblePath({
      category: activeCategory,
      fabric: activeFabric,
      intent: activeIntent,
      q: activeQuery,
      sort: activeSort === "relevance" ? "" : activeSort
    })}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [activeCategory, activeFabric, activeIntent, activeQuery, activeSort]);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"] }
    );
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards.filter((card) => card.active));
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const visibleProducts = products.filter((product) => {
      if (activeCategory && !matchesIdentifier(product.category, activeCategory)) {
        return false;
      }

      if (activeFabric && !matchesIdentifier(product.fabric, activeFabric)) {
        return false;
      }

      if (activeIntent && !matchesProductIntent(product, activeIntent)) {
        return false;
      }

      if (activeQuery && !matchesProductSearch(product, activeQuery)) {
        return false;
      }

      return true;
    });

    return sortProducts(visibleProducts, activeSort, activeQuery);
  }, [activeCategory, activeFabric, activeIntent, activeQuery, activeSort, products]);

  const categoryOptions = useMemo(() => uniqueOptions(products.map((product) => product.category)), [products]);
  const fabricOptions = useMemo(() => uniqueOptions(products.map((product) => product.fabric)), [products]);
  const emptyStateTitle = activeCategory
    ? `${activeCategory} is not available right now`
    : activeFabric
      ? `${activeFabric} is not available right now`
      : activeIntent
        ? `No sarees for ${activeIntent} right now`
        : activeQuery
          ? `No sarees found for "${activeQuery}"`
          : "No sarees available right now";
  const emptyStateCategorySuggestions = useMemo(() => {
    const suggestionsFromCards = categoryCards
      .filter((card) => {
        const primaryFilter = (card.shopFilter || card.title).trim();
        if (!primaryFilter) {
          return false;
        }

        const matchesActiveSelection =
          (activeCategory &&
            (matchesIdentifier(primaryFilter, activeCategory) || matchesIdentifier(card.title, activeCategory))) ||
          (activeFabric &&
            (matchesIdentifier(primaryFilter, activeFabric) || matchesIdentifier(card.title, activeFabric)));

        if (matchesActiveSelection) {
          return false;
        }

        return products.some(
          (product) =>
            matchesIdentifier(product.category, primaryFilter) ||
            matchesIdentifier(product.fabric, primaryFilter) ||
            matchesIdentifier(product.category, card.title) ||
            matchesIdentifier(product.fabric, card.title)
        );
      })
      .map((card) => ({
        href: buildAppCategoryHref(card.shopFilter || card.title),
        label: card.title
      }));

    if (suggestionsFromCards.length > 0) {
      return suggestionsFromCards.slice(0, 6);
    }

    const categorySuggestions = categoryOptions
      .filter((option) => !activeCategory || !matchesIdentifier(option, activeCategory))
      .filter((option) => !activeFabric || !matchesIdentifier(option, activeFabric))
      .map((option) => ({
        href: buildAppCategoryHref(option),
        label: option
      }));

    if (categorySuggestions.length > 0) {
      return categorySuggestions.slice(0, 6);
    }

    return fabricOptions
      .filter((option) => !activeCategory || !matchesIdentifier(option, activeCategory))
      .filter((option) => !activeFabric || !matchesIdentifier(option, activeFabric))
      .map((option) => ({
        href: buildAppSearchHref({ fabric: option }),
        label: option
      }))
      .slice(0, 6);
  }, [activeCategory, activeFabric, categoryCards, categoryOptions, fabricOptions, products]);
  const emptyStateProductSuggestions = useMemo(() => {
    const suggestionLabels = emptyStateCategorySuggestions.map((suggestion) => suggestion.label);
    const fallbackProducts = products.filter((product) => {
      if (activeCategory && matchesIdentifier(product.category, activeCategory)) {
        return false;
      }

      if (activeFabric && matchesIdentifier(product.fabric, activeFabric)) {
        return false;
      }

      if (activeQuery && matchesProductSearch(product, activeQuery)) {
        return false;
      }

      if (activeIntent && !matchesProductIntent(product, activeIntent)) {
        return false;
      }

      return true;
    });

    return sortProducts(fallbackProducts, "relevance", "").sort((left, right) => {
      const leftMatchesSuggestion = suggestionLabels.some(
        (label) => matchesIdentifier(left.category, label) || matchesIdentifier(left.fabric, label)
      );
      const rightMatchesSuggestion = suggestionLabels.some(
        (label) => matchesIdentifier(right.category, label) || matchesIdentifier(right.fabric, label)
      );

      return Number(rightMatchesSuggestion) - Number(leftMatchesSuggestion);
    }).slice(0, 4);
  }, [activeCategory, activeFabric, activeIntent, activeQuery, emptyStateCategorySuggestions, products]);
  const activeFilterCount = [activeCategory, activeFabric, activeIntent].filter(Boolean).length;
  const resultsCountLabel = `${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"}`;

  function applySearch(params: {
    category?: string;
    fabric?: string;
    intent?: string;
    q?: string;
    sort?: SearchSort;
  }) {
    router.push(
      buildAppSearchHref({
        category: params.category,
        fabric: params.fabric,
        intent: params.intent,
        q: params.q,
        sort: params.sort === "relevance" ? "" : params.sort
      })
    );
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applySearch({
      category: activeCategory,
      fabric: activeFabric,
      intent: activeIntent,
      q: searchValue,
      sort: activeSort
    });
  }

  return (
    <MobileAppShell activeTab="categories">
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <div className="sticky top-[calc(env(safe-area-inset-top)+0.2rem)] z-20 -mx-1 rounded-[2rem] border border-[rgba(231,220,205,0.82)] bg-[rgba(255,251,245,0.82)] px-3 py-3 shadow-[0_18px_38px_rgba(94,104,79,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link
              href={buildAppHomeHref()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#2f342d] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
              aria-label="Back to home"
            >
              <ArrowLeftIcon />
            </Link>

            <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
              <div className="flex h-14 items-center gap-3 rounded-full border border-[#e3d8c8] bg-white/90 px-4 shadow-[0_10px_24px_rgba(94,104,79,0.06)]">
                <SearchIcon />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search for sarees, fabrics..."
                  className="h-full min-w-0 flex-1 border-none bg-transparent text-[16px] text-[#2f342d] outline-none placeholder:text-[#8f938b]"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchValue("");
                      applySearch({
                        category: activeCategory,
                        fabric: activeFabric,
                        intent: activeIntent,
                        q: "",
                        sort: activeSort
                      });
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f1eee7] text-[#646d61]"
                    aria-label="Clear search"
                  >
                    <CloseIcon />
                  </button>
                ) : null}
              </div>
            </form>

            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="relative inline-flex h-14 shrink-0 items-center gap-2 rounded-full border border-[#e3d8c8] bg-white/90 px-4 text-[0.88rem] font-medium text-[#4f5942] shadow-[0_10px_24px_rgba(94,104,79,0.06)]"
            >
              <FilterIcon />
              <span>{activeFilterCount > 0 ? "Filters" : "Filter"}</span>
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#5e684f] px-2 text-[0.78rem] font-semibold text-[#fbf4e8]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.92rem] font-semibold text-[#2f342d]">Popular searches</p>
            <div className="text-right">
              <p className="text-[0.86rem] font-semibold text-[#2f342d]">{resultsCountLabel}</p>
              {(activeQuery || activeFilterCount > 0) ? (
                <p className="mt-0.5 text-[0.72rem] text-[#68735e]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                    : `Search: ${activeQuery}`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
            {POPULAR_SEARCHES.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => applySearch({ q: chip, category: activeCategory, fabric: activeFabric, intent: activeIntent, sort: activeSort })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e4dacb] bg-white/72 px-3 py-1.5 text-[0.8rem] font-medium text-[#3a4337]"
              >
                <SearchIcon small />
                <span>{chip}</span>
              </button>
            ))}
          </div>
        </section>

        {(activeCategory || activeFabric || activeIntent || activeQuery) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeQuery ? <ActiveFilterPill label={activeQuery} onClear={() => applySearch({ category: activeCategory, fabric: activeFabric, intent: activeIntent, q: "", sort: activeSort })} /> : null}
            {activeCategory ? <ActiveFilterPill label={activeCategory} onClear={() => applySearch({ fabric: activeFabric, intent: activeIntent, q: activeQuery, sort: activeSort })} /> : null}
            {activeFabric ? <ActiveFilterPill label={activeFabric} onClear={() => applySearch({ category: activeCategory, intent: activeIntent, q: activeQuery, sort: activeSort })} /> : null}
            {activeIntent ? <ActiveFilterPill label={activeIntent} onClear={() => applySearch({ category: activeCategory, fabric: activeFabric, q: activeQuery, sort: activeSort })} /> : null}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => (
            <MobileProductCard key={product.id ?? product.sku} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <section className="mt-6 rounded-[1.7rem] border border-dashed border-[#dccfb9] bg-[#fffaf2] px-5 py-8 text-center">
            <p className="brand-copy text-[1.28rem] leading-tight text-[#2f342d]">{emptyStateTitle}</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-[#68735e]">
              Try another category or open the full collection.
            </p>

            {emptyStateCategorySuggestions.length > 0 ? (
              <div className="mt-5">
                <p className="brand-caption text-[0.66rem] font-semibold tracking-[0.22em] text-[#7a846f]">
                  EXPLORE OTHER CATEGORIES
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-left">
                  {emptyStateCategorySuggestions.map((suggestion) => (
                    <Link
                      key={suggestion.href}
                      href={suggestion.href}
                      className="rounded-[1.2rem] border border-[#e5d9c8] bg-white/88 px-3 py-3 text-[0.88rem] font-medium text-[#394234] shadow-[0_8px_18px_rgba(94,104,79,0.05)]"
                    >
                      {suggestion.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {emptyStateProductSuggestions.length > 0 ? (
              <div className="mt-5 text-left">
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {emptyStateProductSuggestions.map((product) => (
                    <MobileProductCard
                      key={`${product.id ?? product.sku}-empty-state`}
                      product={product}
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              href={buildAppSearchHref()}
              className="brand-caption mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#5e684f] px-5 text-[0.7rem] font-semibold tracking-[0.16em] text-[#fbf4e8]"
            >
              VIEW ALL SAREES
            </Link>
          </section>
        ) : null}
      </div>

      <MobileFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        searchValue={searchValue}
        category={draftCategory}
        fabric={draftFabric}
        intent={draftIntent}
        sort={draftSort}
        categoryOptions={categoryOptions}
        fabricOptions={fabricOptions}
        onChangeSearch={setSearchValue}
        onChangeCategory={setDraftCategory}
        onChangeFabric={setDraftFabric}
        onChangeIntent={setDraftIntent}
        onChangeSort={setDraftSort}
      onApply={() => {
          applySearch({
            q: searchValue.trim(),
            category: draftCategory,
            fabric: draftFabric,
            intent: draftIntent,
            sort: draftSort
          });
          setFilterSheetOpen(false);
        }}
      onClear={() => {
          setSearchValue("");
          setDraftCategory("");
          setDraftFabric("");
          setDraftIntent("");
          setDraftSort("relevance");
          applySearch({});
          setFilterSheetOpen(false);
        }}
      />
    </MobileAppShell>
  );
}

export function MobileAppFavoritesPage() {
  const { favoriteSkus, removeFavoriteSkus } = useFavorites();
  const { addItem, items, removeItem, updateQuantity } = useCart();
  const [products, setProducts] = useState<Saree[]>([]);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"] }
    );
  }, []);

  const favoriteProducts = useMemo(() => {
    const productsBySku = new Map(products.map((product) => [product.sku, product]));
    return favoriteSkus
      .map((sku) => productsBySku.get(sku))
      .filter((product): product is Saree => Boolean(product));
  }, [favoriteSkus, products]);

  return (
    <MobileAppShell activeTab="favorites">
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <PageHeading title="Wishlist" subtitle="Pieces you marked to revisit later." />

        {favoriteProducts.length === 0 ? (
          <EmptyStateCard
            title="No saved sarees yet"
            description="Tap the heart on any product to keep it here for later."
            actionHref={buildAppSearchHref()}
            actionLabel="Browse collection"
          />
        ) : (
          <div className="mt-5 space-y-3">
            {favoriteProducts.map((product) => {
              const quantityInBag = items.find((item) => item.sku === product.sku)?.quantity ?? 0;

              return (
                <article
                  key={product.id ?? product.sku}
                  className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-[1.55rem] border border-[#eadfce] bg-white/85 p-3 shadow-[0_10px_24px_rgba(94,104,79,0.06)]"
                >
                  <div
                    className="aspect-square rounded-[1.15rem] bg-[#efe5d7]"
                    style={buildImageBackgroundStyle(product.primaryImageUrl)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="brand-copy truncate text-[1.06rem] leading-tight text-[#2f342d]">{product.name}</p>
                        <p className="mt-1 text-[0.84rem] text-[#68735e]">{getMobileProductLabel(product)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFavoriteSkus([product.sku])}
                        className="shrink-0 rounded-full bg-[#f3efe8] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d5e5b]"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2.5">
                      <div>
                        <p className="text-[0.94rem] font-semibold text-[#2b2a29]">{formatCurrency(product.price)}</p>
                        {typeof product.originalPrice === "number" ? (
                          <p className="text-[0.82rem] text-[#9a9a93] line-through">
                            {formatCurrency(product.originalPrice)}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        {quantityInBag > 0 ? (
                          <div className="grid grid-cols-[2.2rem_1fr_2.2rem] items-center rounded-full bg-[#5e684f] px-1 py-1 text-[#fbf4e8]">
                            <QuantityButton
                              label="Decrease quantity"
                              onClick={() => updateQuantity(product.sku, quantityInBag - 1)}
                            >
                              -
                            </QuantityButton>
                            <span className="text-center text-[0.78rem] font-semibold">{quantityInBag}</span>
                            <QuantityButton
                              label="Increase quantity"
                              onClick={() => updateQuantity(product.sku, quantityInBag + 1)}
                              disabled={quantityInBag >= getPurchasableQuantityLimit(product.availableStock)}
                            >
                              +
                            </QuantityButton>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isProductPurchasable(product)}
                            onClick={() => {
                              addItem(product, 1);
                            }}
                            className="brand-caption inline-flex w-full items-center justify-center whitespace-nowrap rounded-full bg-[#5e684f] px-3 py-2.5 text-[0.52rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
                          >
                            ADD TO CART
                          </button>
                        )}
                        <Link
                          href={buildAppProductHref(product.slug)}
                          className="brand-caption inline-flex w-full items-center justify-center whitespace-nowrap rounded-full border border-[#d7ccb9] px-3 py-2.5 text-[0.52rem] font-semibold tracking-[0.14em] text-[#56624d]"
                        >
                          DETAILS
                        </Link>
                      </div>
                      {quantityInBag > 0 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(product.sku)}
                          className="brand-caption mt-2.5 inline-flex w-full items-center justify-center whitespace-nowrap rounded-full border border-[#d7ccb9] px-3 py-2.5 text-[0.52rem] font-semibold tracking-[0.14em] text-[#8d5c56]"
                        >
                          REMOVE FROM BAG
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MobileAppShell>
  );
}

export function MobileAppOrdersPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuthSession();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [products, setProducts] = useState<Saree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setOrders([]);
      return;
    }

    return subscribeToCustomerOrders(
      user.uid,
      (nextOrders) => {
        setOrders(nextOrders);
        setError(null);
        setActionError(null);
      },
      (nextError) => {
        setOrders([]);
        setError(nextError.message);
      }
    );
  }, [user?.uid]);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"] },
      () => {
        setProducts([]);
      }
    );
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  function handleShopAgain(order: CheckoutOrder) {
    const reorderSelections = buildReorderSelections(order, products);

    if (reorderSelections.length === 0) {
      setMessage(null);
      setActionError("These items are no longer available to add back into the cart.");
      return;
    }

    reorderSelections.forEach(({ product, quantity }) => {
      addItem(product, quantity);
    });

    const totalAdded = reorderSelections.reduce((sum, selection) => sum + selection.quantity, 0);
    setActionError(null);
    setMessage(`${totalAdded} item${totalAdded === 1 ? "" : "s"} added to cart.`);
    router.push(buildAppSearchHref());
  }

  return (
    <MobileAppShell activeTab="account">
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <PageHeading title="Orders" subtitle="Track the pieces you have already placed." />

        {!user ? (
          <SignInCard
            title="Sign in to see your orders"
            description="Your mobile cart stays separate, but order history belongs to your account."
            actionLabel={loading ? "CHECKING SESSION" : "CONTINUE WITH SMS"}
            onAction={() => void signIn()}
            disabled={loading}
          />
        ) : error ? (
          <EmptyStateCard title="Orders could not be loaded" description={error} />
        ) : orders.length === 0 ? (
          <EmptyStateCard
            title="No orders yet"
            description="Once you place an order from checkout, it will appear here."
            actionHref={buildAppSearchHref()}
            actionLabel="Start shopping"
          />
        ) : (
          <div className="mt-5 space-y-3">
            {actionError ? <p className="text-[0.92rem] text-[#a8574d]">{actionError}</p> : null}
            {message ? <p className="text-[0.92rem] text-[#5e684f]">{message}</p> : null}
            {orders.map((order) => {
              const expanded = openOrderId === order.id;
              const itemCount = order.cartItems?.reduce((count, item) => count + item.quantity, 0) ?? 0;

              return (
                <article
                  key={order.id}
                  className="rounded-[1.55rem] border border-[#eadfce] bg-white/88 p-4 shadow-[0_10px_24px_rgba(94,104,79,0.06)]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(expanded ? "" : order.id)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div>
                      <p className="brand-copy text-[1.25rem] text-[#2f342d]">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-[0.9rem] text-[#68735e]">
                        {formatDateValue(order.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${
                        order.dispatchStatus === "completed"
                          ? "bg-[#edf4e7] text-[#4f5942]"
                          : "bg-[#fff0eb] text-[#a8574d]"
                      }`}>
                        {order.dispatchStatus === "completed" ? "Dispatched" : "Pending"}
                      </span>
                      <p className="mt-2 text-[1rem] font-semibold text-[#2b2a29]">
                        {formatCurrency(order.amountBreakdown?.total ?? (order.amountPaise ?? 0) / 100)}
                      </p>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="mt-4 border-t border-[#efe4d4] pt-4">
                      <div className="space-y-2 text-[0.94rem] text-[#667056]">
                        {(order.cartItems ?? []).map((item) => (
                          <div key={`${item.sku}-${item.quantity}`} className="flex items-center justify-between gap-3">
                            <span>
                              {item.name} · Qty {item.quantity}
                            </span>
                            <span>{formatCurrency((item.unitPrice ?? 0) * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openOrderReceiptPreview(buildOrderConfirmationFromOrder(order))}
                          className="brand-caption rounded-full bg-[#5e684f] px-4 py-2.5 text-[0.62rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
                        >
                          VIEW RECEIPT
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShopAgain(order)}
                          className="brand-caption rounded-full border border-[#d7ccb9] px-4 py-2.5 text-[0.62rem] font-semibold tracking-[0.14em] text-[#56624d]"
                        >
                          SHOP AGAIN
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MobileAppShell>
  );
}

export function MobileAppAccountPage() {
  const { user, loading, signIn, signOut } = useAuthSession();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [addressForm, setAddressForm] = useState<PaymentFormState>(emptyAddressForm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const customerAuthLabel = getCustomerAuthDisplayLabel(user);
  const accountDisplayName =
    user?.displayName?.trim() || selectedAddress?.fullName?.trim() || addressForm.fullName.trim() || "Account";

  useEffect(() => {
    if (!user?.uid) {
      setSelectedAddress(null);
      setOrders([]);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    const userId = user.uid;
    const userDisplayName = user.displayName ?? "";
    const userEmail = user.email ?? "";
    const userPhone = user.phoneNumber ?? "";

    async function loadProfile() {
      setProfileLoading(true);

      try {
        const customerProfile = await getCustomerProfile(userId);

        if (cancelled) {
          return;
        }

        const address = customerProfile?.addresses?.[0]
          ? applyVerifiedPhoneToAddress(customerProfile.addresses[0], userPhone)
          : null;
        setSelectedAddress(address);
        setAddressForm(
          address
            ? {
                address: address.address,
                city: address.city,
                email: address.email,
                fullName: address.fullName,
                phone: resolveVerifiedPhone(userPhone, address.phone),
                pincode: address.pincode,
                state: address.state
              }
            : {
                ...emptyAddressForm,
                fullName: userDisplayName,
                email: userEmail,
                phone: resolveVerifiedPhone(userPhone)
              }
        );
        setProfileError(null);
      } catch (error) {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : "Profile could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.displayName, user?.email, user?.phoneNumber, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const userId = user.uid;

    return subscribeToCustomerOrders(userId, (nextOrders) => {
      setOrders(nextOrders.slice(0, 5));
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!profileMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setProfileMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [profileMessage]);

  async function handleSaveAddress() {
    if (!user?.uid) {
      return;
    }

    const userId = user.uid;

    const nextAddress = buildSingleAddress(addressForm, user.phoneNumber);

    if (!nextAddress) {
      setProfileError("Complete the address details before saving.");
      return;
    }

    setProfileSaving(true);

    try {
      await syncCustomerDisplayName(nextAddress.fullName);
      await saveCustomerProfile(userId, {
        fullName: nextAddress.fullName,
        email: nextAddress.email,
        phone: nextAddress.phone,
        address: nextAddress.address,
        city: nextAddress.city,
        state: nextAddress.state,
        pincode: nextAddress.pincode,
        selectedAddressId: nextAddress.id,
        addresses: [nextAddress]
      });
      setSelectedAddress(nextAddress);
      setProfileMessage("Address saved.");
      setProfileError(null);
      setSheetOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Address could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleConfirmSignOut() {
    setSignOutPending(true);

    try {
      await signOut();
      setSignOutConfirmOpen(false);
    } finally {
      setSignOutPending(false);
    }
  }

  return (
    <MobileAppShell activeTab="account">
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <PageHeading
          eyebrow="Account"
          title={user ? accountDisplayName : "Account"}
          subtitle={user ? "Review saved address and your recent orders in one place." : "Sign in to manage address and orders."}
        />

        {!user ? (
          <SignInCard
            title="Open your account"
            description="Use mobile verification to access your saved address, orders, and wishlist."
            actionLabel={loading ? "CHECKING SESSION" : "CONTINUE WITH SMS"}
            onAction={() => void signIn()}
            disabled={loading}
          />
        ) : (
          <>
            <section className="mt-4 rounded-[1.8rem] border border-[#eadfce] bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Saved address</p>
                  <p className="mt-2 text-[0.96rem] text-[#68735e]">One primary address for faster checkout.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  disabled={profileLoading && !selectedAddress}
                  className="brand-caption rounded-full bg-[#5e684f] px-4 py-2.5 text-[0.62rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
                >
                  {profileLoading && !selectedAddress ? "ADDRESS" : selectedAddress ? "EDIT" : "ADD ADDRESS"}
                </button>
              </div>

              {profileMessage ? <p className="mt-3 text-[0.9rem] text-[#5e684f]">{profileMessage}</p> : null}
              {profileError ? <p className="mt-3 text-[0.9rem] text-[#a8574d]">{profileError}</p> : null}

              {profileLoading ? (
                <p className="mt-4 text-[0.94rem] text-[#68735e]">Loading address...</p>
              ) : selectedAddress ? (
                <div className="mt-4 rounded-[1.35rem] bg-[#faf6ef] px-4 py-4 text-[0.96rem] leading-7 text-[#54604c]">
                  <p className="brand-copy text-[1.3rem] leading-tight text-[#2f342d]">{selectedAddress.fullName}</p>
                  <p className="mt-2">{selectedAddress.address}</p>
                  <p>
                    {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                  </p>
                  <p>{selectedAddress.phone}</p>
                </div>
              ) : (
                <p className="mt-4 text-[0.94rem] leading-7 text-[#68735e]">No address saved yet.</p>
              )}
            </section>

            <section className="mt-4 rounded-[1.8rem] border border-[#eadfce] bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Recent orders</p>
                  <p className="mt-2 text-[0.96rem] text-[#68735e]">Your latest checkout activity.</p>
                </div>
                <Link
                  href={buildAppOrdersHref()}
                  className="brand-caption rounded-full border border-[#d7ccb9] px-4 py-2.5 text-[0.62rem] font-semibold tracking-[0.14em] text-[#56624d]"
                >
                  VIEW ALL
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {orders.length === 0 ? (
                  <p className="text-[0.94rem] text-[#68735e]">No orders yet.</p>
                ) : (
                  orders.map((order) => {
                    const itemCount = order.cartItems?.reduce((count, item) => count + item.quantity, 0) ?? 0;

                    return (
                      <div key={order.id} className="rounded-[1.25rem] bg-[#faf6ef] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="brand-copy text-[1.1rem] text-[#2f342d]">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="mt-1 text-[0.88rem] text-[#68735e]">{formatDateValue(order.createdAt)}</p>
                          </div>
                          <p className="text-[0.98rem] font-semibold text-[#2b2a29]">
                            {formatCurrency(order.amountBreakdown?.total ?? (order.amountPaise ?? 0) / 100)}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eadfce] pt-3">
                          <div className="text-[0.82rem] text-[#68735e]">
                            {itemCount || 1} item{itemCount === 1 ? "" : "s"}
                          </div>
                          <button
                            type="button"
                            onClick={() => openOrderReceiptPreview(buildOrderConfirmationFromOrder(order))}
                            className="brand-caption rounded-full bg-[#5e684f] px-4 py-2.5 text-[0.6rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
                          >
                            VIEW RECEIPT
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <div className="mt-5">
              <section className="rounded-[1.8rem] border border-[#eadfce] bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">
                      Session
                    </p>
                    <p className="mt-2 text-[0.94rem] text-[#68735e]">Sign out from this mobile app session.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignOutConfirmOpen(true)}
                    className="brand-caption whitespace-nowrap rounded-full border border-[#cda9a3] bg-[#fff3ef] px-3 py-2 text-[0.56rem] font-semibold tracking-[0.1em] text-[#9d4b45]"
                  >
                    SIGN OUT
                  </button>
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      <MobileAddressSheet
        open={sheetOpen}
        title={selectedAddress ? "Edit address" : "Add address"}
        form={addressForm}
        pending={profileSaving}
        verifiedPhone={resolveVerifiedPhone(user?.phoneNumber, addressForm.phone)}
        onClose={() => setSheetOpen(false)}
        onFieldChange={(field, value) =>
          setAddressForm((currentForm) => ({
            ...currentForm,
            [field]: value
          }))
        }
        onSave={() => void handleSaveAddress()}
      />

      <MobileBottomSheet open={signOutConfirmOpen} onClose={() => (signOutPending ? undefined : setSignOutConfirmOpen(false))} title="Sign out">
        <div className="space-y-4">
          <p className="text-[0.94rem] leading-7 text-[#68735e]">
            You will be signed out of your eshwe account on this app. Your wishlist, orders, and saved address will still be available after you sign in again.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleConfirmSignOut()}
              disabled={signOutPending}
              className="brand-caption rounded-[1rem] bg-[#9d4b45] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fff7f4] disabled:opacity-55"
            >
              {signOutPending ? "SIGNING OUT" : "CONFIRM"}
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(false)}
              disabled={signOutPending}
              className="brand-caption rounded-[1rem] border border-[#d7ccb9] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#56624d] disabled:opacity-55"
            >
              CANCEL
            </button>
          </div>
        </div>
      </MobileBottomSheet>
    </MobileAppShell>
  );
}

export function MobileAppProductPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "/app/product";
  const searchParams = useSearchParams();
  const currentSearchParams = searchParams ?? new URLSearchParams();
  const { addItem, items, updateQuantity, totalItems } = useCart();
  const [products, setProducts] = useState<Saree[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const slug = useMemo(
    () => resolveAppProductSlug(pathname, currentSearchParams.get("slug")),
    [currentSearchParams, pathname]
  );

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"] }
    );
  }, []);

  const product = products.find((entry) => matchesIdentifier(entry.slug, slug)) ?? null;
  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    return products
      .filter((entry) => entry.sku !== product.sku)
      .filter((entry) => matchesIdentifier(entry.category, product.category) || matchesIdentifier(entry.fabric, product.fabric))
      .slice(0, 6);
  }, [product, products]);
  const gallery = product ? getProductGallery(product) : [];
  const cartQuantity = product ? items.find((item) => item.sku === product.sku)?.quantity ?? 0 : 0;
  const canIncreaseQuantity = product ? cartQuantity < getPurchasableQuantityLimit(product.availableStock) : false;
  const productFacts = product ? buildMobileProductFacts(product) : [];
  const materialCareFacts = product ? buildMobileMaterialCareFacts(product) : [];
  const sareeCareTips = product?.sareeCareTips?.length ? product.sareeCareTips : defaultSareeCareTips;
  const dryingTips = product?.dryingTips?.length ? product.dryingTips : defaultDryingTips;
  const productNote = product?.productNote || defaultProductNote;

  function scrollToGalleryImage(index: number) {
    setCurrentImageIndex(index);
    galleryRef.current?.scrollTo({
      left: galleryRef.current.clientWidth * index,
      behavior: "smooth"
    });
  }

  useEffect(() => {
    if (typeof window === "undefined" || !slug) {
      return;
    }

    const nextUrl = `${buildAppProductPath(slug)}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [slug]);

  if (!product) {
    return (
      <MobileAppShell showBottomNav={false}>
        <div className="px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <Link
            href={buildAppSearchHref()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#2f342d]"
          >
            <ArrowLeftIcon />
          </Link>
          <EmptyStateCard
            title="Product not found"
            description="This saree could not be loaded. Try browsing the collection again."
            actionHref={buildAppSearchHref()}
            actionLabel="Back to browse"
          />
        </div>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell showBottomNav={false}>
      <div className="px-4 pb-[calc(6.8rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#2f342d] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
            aria-label="Back"
          >
            <ArrowLeftIcon />
          </button>
          <Image src="/eshwelogo-transparent.png" alt="eshwe" width={72} height={72} className="h-16 w-16 object-contain" />
          <Link href={buildAppCheckoutHref()} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#5e684f] shadow-[0_8px_20px_rgba(94,104,79,0.06)]">
            <BagOutlineIcon />
            {totalItems > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a8574d] px-1 text-[0.68rem] font-semibold text-[#fbf4e8]">
                {totalItems}
              </span>
            ) : null}
          </Link>
        </div>

        <section className="mt-5">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#efe5d7] shadow-[0_18px_48px_rgba(94,104,79,0.12)]">
            <div
              ref={galleryRef}
              className="flex snap-x snap-mandatory overflow-x-auto hide-scrollbar"
              onScroll={(event) => {
                const target = event.currentTarget;
                const nextIndex = Math.round(target.scrollLeft / target.clientWidth);
                setCurrentImageIndex(nextIndex);
              }}
            >
              {gallery.map((imageUrl) => (
                <div key={imageUrl} className="aspect-[0.82] w-full shrink-0 snap-center" style={buildImageBackgroundStyle(imageUrl)} />
              ))}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,49,36,0)_52%,rgba(36,49,36,0.14)_100%)]" />
            <FavoriteToggleButton sku={product.sku} className="absolute right-4 top-4 z-10" />
            {gallery.length > 1 ? (
              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
                {gallery.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    aria-label={`View image ${index + 1}`}
                    onClick={() => scrollToGalleryImage(index)}
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      index === currentImageIndex ? "w-7 bg-[#5e684f]" : "w-2.5 bg-white/75"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {gallery.length > 1 ? (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
              {gallery.map((imageUrl, index) => (
                <button
                  key={`${imageUrl}-thumb`}
                  type="button"
                  onClick={() => scrollToGalleryImage(index)}
                  className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-[1rem] border ${
                    index === currentImageIndex ? "border-[#5e684f] shadow-[0_10px_24px_rgba(94,104,79,0.14)]" : "border-[#eadfce]"
                  }`}
                >
                  <span className="absolute inset-0" style={buildImageBackgroundStyle(imageUrl)} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-5 rounded-[1.85rem] border border-[#eadfce] bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">{product.category}</p>
                <h1 className="brand-copy mt-3 text-[2rem] leading-tight text-[#2f342d]">{product.name}</h1>
                <p className="mt-2 text-[1rem] text-[#68735e]">{getMobileProductLabel(product)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <p className="text-[1.8rem] font-semibold leading-none text-[#2b2a29]">{formatCurrency(product.price)}</p>
              {typeof product.originalPrice === "number" ? (
                <p className="pb-0.5 text-[1.1rem] text-[#9a9a93] line-through">
                  {formatCurrency(product.originalPrice)}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {getProductDiscoveryTags(product).map((tag) => (
                <span key={tag} className="rounded-full bg-[#f2f6ec] px-3 py-1.5 text-[0.82rem] font-medium text-[#5e684f]">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniTrustTile title="Soft drape" subtitle="Handpicked feel" />
              <MiniTrustTile title="Secure pay" subtitle="Razorpay flow" />
              <MiniTrustTile title="Fast support" subtitle="Order help" />
            </div>

            <div className="mt-5 rounded-[1.35rem] bg-[#faf6ef] px-4 py-4 text-[0.95rem] leading-7 text-[#667056]">
              {product.description}
            </div>

            <div className="mt-5 grid gap-3">
              <TrustRow title="Handpicked fabric and finish" description="Each saree is selected to feel soft, elegant, and easy to wear." />
              <TrustRow title="Secure checkout with Razorpay" description="UPI, cards, net banking, and wallets open inside the payment step." />
              <TrustRow title="Support if you need help" description="Use your account and contact routes for order or address support." />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {productFacts.map((fact) => (
                <DetailFactCard key={fact.label} label={fact.label} value={fact.value} />
              ))}
              {materialCareFacts.map((fact) => (
                <DetailFactCard key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              <DetailTipsCard
                title="Saree care"
                subtitle="Washing and handling instructions"
                tips={sareeCareTips}
              />
              <DetailTipsCard
                title="Drying and finishing"
                subtitle="Keep the drape and finish looking fresh"
                tips={dryingTips}
              />
              <TrustRow title="Product note" description={productNote} />
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 ? (
          <MobileRecommendationSection
            title="You may also like"
            products={relatedProducts.slice(0, 4)}
            viewAllHref={buildAppSearchHref({ category: product.category })}
          />
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.95rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[430px] items-center gap-2.5 rounded-[1.7rem] border border-[rgba(214,203,185,0.82)] bg-[rgba(255,251,245,0.94)] px-3 py-2.5 shadow-[0_20px_42px_rgba(47,40,32,0.14)] backdrop-blur-xl">
          {cartQuantity > 0 ? (
            <div className="grid w-full grid-cols-[3rem_1fr_3rem] items-center rounded-[1rem] bg-[#5e684f] px-1.5 py-1.5 text-[#fbf4e8]">
              <QuantityButton label="Decrease quantity" onClick={() => updateQuantity(product.sku, cartQuantity - 1)}>
                -
              </QuantityButton>
              <span className="text-center text-[0.86rem] font-semibold">{cartQuantity}</span>
              <QuantityButton
                label="Increase quantity"
                onClick={() => updateQuantity(product.sku, cartQuantity + 1)}
                disabled={!canIncreaseQuantity}
              >
                +
              </QuantityButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (product.status === "out_of_stock") {
                  setWaitlistDialogOpen(true);
                  return;
                }

                addItem(product, 1);
              }}
              disabled={product.status !== "out_of_stock" && !isProductPurchasable(product)}
              className="brand-caption inline-flex w-full items-center justify-center rounded-[1rem] bg-[#5e684f] px-4 py-3.5 text-[0.6rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
            >
              {product.status === "out_of_stock" ? "NOTIFY ME" : "ADD TO CART"}
            </button>
          )}
        </div>
      </div>

      <NotifyWaitlistDialog
        open={waitlistDialogOpen}
        product={waitlistDialogOpen ? product : null}
        onClose={() => setWaitlistDialogOpen(false)}
      />
    </MobileAppShell>
  );
}

export function MobileAppCheckoutPage() {
  const router = useRouter();
  const { items, subtotal, savings, shippingFee, packagingFee, total, totalItems, updateQuantity, removeItem, clearCart, isReady } = useCart();
  const { user, signIn } = useAuthSession();
  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<PaymentFormState>(emptyAddressForm);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileResolvedUserId, setProfileResolvedUserId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentOverlayStep, setPaymentOverlayStep] = useState<PaymentOverlayStep>(null);
  const [checkoutStep, setCheckoutStep] = useState<"bag" | "delivery" | "address" | "pay">("bag");
  const [signInPhone, setSignInPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const redirectRef = useRef(false);
  const autoPromptedAddressUserIdRef = useRef("");
  const deliverySectionRef = useRef<HTMLElement | null>(null);
  const paySectionRef = useRef<HTMLElement | null>(null);
  const [products, setProducts] = useState<Saree[]>([]);
  const hasUnavailableItems = items.some((item) => isCartItemUnavailable(item));
  const activeAddress = user ? savedAddress : null;
  const canProceed = items.length > 0 && !hasUnavailableItems && Boolean(activeAddress);
  const showVerificationStep = checkoutStep === "delivery";
  const showAddressStep = checkoutStep === "address";

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (items.length === 0 && !redirectRef.current) {
      router.replace(buildAppSearchHref());
    }
  }, [isReady, items.length, router]);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
      },
      { status: ["active", "out_of_stock"] }
    );
  }, []);

  useEffect(() => {
    if (checkoutStep === "pay" && !activeAddress && !paymentSubmitting && !paymentOverlayStep) {
      setCheckoutStep("address");
    }
  }, [activeAddress, checkoutStep, paymentOverlayStep, paymentSubmitting]);

  useEffect(() => {
    if (checkoutStep === "delivery" && user?.uid) {
      setCheckoutStep("address");
      scrollToSection("delivery");
    }
  }, [checkoutStep, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setSavedAddress(null);
      setProfileLoading(false);
      setProfileResolvedUserId("");
      autoPromptedAddressUserIdRef.current = "";
      return;
    }

    let cancelled = false;
    const userId = user.uid;
    const userDisplayName = user.displayName ?? "";
    const userEmail = user.email ?? "";
    const userPhone = user.phoneNumber ?? "";

    async function loadProfile() {
      setProfileLoading(true);
      setProfileResolvedUserId("");

      try {
        const profile = await getCustomerProfile(userId);

        if (cancelled) {
          return;
        }

        const address = profile?.addresses?.[0]
          ? applyVerifiedPhoneToAddress(profile.addresses[0], userPhone)
          : null;
        setSavedAddress(address);
        setAddressForm(
          address
            ? {
                address: address.address,
                city: address.city,
                email: address.email,
                fullName: address.fullName,
                phone: resolveVerifiedPhone(userPhone, address.phone),
                pincode: address.pincode,
                state: address.state
              }
            : {
                ...emptyAddressForm,
                fullName: userDisplayName,
                email: userEmail,
                phone: resolveVerifiedPhone(userPhone)
              }
        );
        setProfileError(null);
      } catch (error) {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : "Address could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
          setProfileResolvedUserId(userId);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.displayName, user?.email, user?.phoneNumber, user?.uid]);

  const recommendations = useMemo(() => buildMobileCheckoutRecommendations(products, items), [items, products]);
  const visibleRecommendations = useMemo(() => recommendations.slice(0, 4), [recommendations]);
  const checkoutRecommendationHref = useMemo(() => {
    const primaryRecommendation = recommendations[0];

    if (primaryRecommendation?.category?.trim()) {
      return buildAppSearchHref({ category: primaryRecommendation.category });
    }

    if (primaryRecommendation?.fabric?.trim()) {
      return buildAppSearchHref({ fabric: primaryRecommendation.fabric });
    }

    return buildAppSearchHref();
  }, [recommendations]);

  function normalizePhoneInput(value: string) {
    return value.replace(/\D/g, "").slice(0, 10);
  }

  async function handleStartMobileVerification() {
    const normalizedPhone = normalizePhoneInput(signInPhone);

    if (normalizedPhone.length !== 10) {
      setProfileError("Enter your 10-digit mobile number.");
      return;
    }

    setProfileError(null);

    try {
      await signIn({
        autoSend: true,
        phone: normalizedPhone
      });
      setCheckoutStep("address");
      scrollToSection("delivery");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function handleSaveAddress() {
    if (!user?.uid) {
      return;
    }

    const userId = user.uid;

    const nextAddress = buildSingleAddress(addressForm, user.phoneNumber);

    if (!nextAddress) {
      setProfileError("Complete the address details first.");
      return;
    }

    setProfileSaving(true);

    try {
      await syncCustomerDisplayName(nextAddress.fullName);
      await saveCustomerProfile(userId, {
        fullName: nextAddress.fullName,
        email: nextAddress.email,
        phone: nextAddress.phone,
        address: nextAddress.address,
        city: nextAddress.city,
        state: nextAddress.state,
        pincode: nextAddress.pincode,
        selectedAddressId: nextAddress.id,
        addresses: [nextAddress]
      });
      setSavedAddress(nextAddress);
      setAddressSheetOpen(false);
      setProfileError(null);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Address could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleProceedToPayment() {
    if (!user) {
      setProfileError("Verify your mobile number to continue.");
      return;
    }

    if (!activeAddress || hasUnavailableItems || items.length === 0) {
      if (!activeAddress) {
        setProfileError("Add your delivery address before continuing.");
        setAddressSheetOpen(true);
      }
      return;
    }

    setProfileError(null);
    setCheckoutStep("pay");
    await startRazorpayCheckout(activeAddress);
  }

  function scrollToSection(section: "delivery" | "pay") {
    const target = section === "delivery" ? deliverySectionRef.current : paySectionRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleStepNavigation(step: "bag" | "delivery" | "pay") {
    if (step === "bag") {
      setProfileError(null);
      setCheckoutStep("bag");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (step === "delivery") {
      if (items.length === 0) {
        return;
      }

      setProfileError(null);
      setCheckoutStep(user ? "address" : "delivery");
      scrollToSection("delivery");
      return;
    }

    if (!user) {
      setProfileError("Verify your mobile number to continue.");
      setCheckoutStep("delivery");
      scrollToSection("delivery");
      return;
    }

    if (!activeAddress) {
      setProfileError("Add your delivery address before continuing.");
      setCheckoutStep("address");
      scrollToSection("delivery");
      return;
    }

    setProfileError(null);
    setCheckoutStep("pay");
    scrollToSection("pay");
  }

  function handleContinueFromBag() {
    if (items.length === 0) {
      return;
    }

    if (hasUnavailableItems) {
      setProfileError("One or more sarees are no longer available. Please update the bag before continuing.");
      return;
    }

    setProfileError(null);
    setCheckoutStep(user ? "address" : "delivery");
    scrollToSection("delivery");
  }

  async function handleContinueFromAddress() {
    if (user && profileLoading) {
      setProfileError(null);
      return;
    }

    if (!user) {
      setCheckoutStep("delivery");
      scrollToSection("delivery");
      return;
    }

    if (!activeAddress) {
      setProfileError("Add your delivery address before continuing.");
      setAddressSheetOpen(true);
      return;
    }

    setProfileError(null);
    setCheckoutStep("pay");
    scrollToSection("pay");
  }

  async function handlePrimaryCheckoutAction() {
    if (checkoutStep === "bag") {
      handleContinueFromBag();
      return;
    }

    if (checkoutStep === "delivery") {
      await handleStartMobileVerification();
      return;
    }

    if (checkoutStep === "address") {
      await handleContinueFromAddress();
      return;
    }

    await handleProceedToPayment();
  }

  const primaryButtonLabel = paymentSubmitting
    ? paymentMessage === "Redirecting to secure payment"
      ? "OPENING RAZORPAY"
      : "PROCESSING"
    : checkoutStep === "bag"
      ? "CHECKOUT"
      : checkoutStep === "delivery"
        ? "VERIFY MOBILE"
        : checkoutStep === "address"
          ? user && profileLoading
            ? "VERIFYING USER"
            : !user
              ? "VERIFY MOBILE"
              : activeAddress
                ? "CONFIRM ADDRESS AND PROCEED"
                : "ADD ADDRESS"
          : "PAY NOW";

  async function startRazorpayCheckout(deliveryAddress: PaymentFormState) {
    setPaymentSubmitting(true);
    setPaymentMessage("Redirecting to secure payment");

    try {
      const order = await createOrder(items, deliveryAddress, orderNotes.trim());

      if (!window.Razorpay) {
        await loadRazorpayCheckoutScript();
      }

      let checkoutFinished = false;

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable right now.");
      }

      const checkoutOptions: RazorpayCheckoutOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        description: `Secure checkout for ${order.lineItems.length} item${order.lineItems.length === 1 ? "" : "s"}`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: deliveryAddress.fullName,
          email: deliveryAddress.email,
          contact: deliveryAddress.phone
        },
        notes: {
          internalOrderId: order.internalOrderId,
          customerPhone: deliveryAddress.phone
        },
        modal: {
          ondismiss: () => {
            if (checkoutFinished) {
              return;
            }

            setCheckoutStep("delivery");
            setPaymentOverlayStep(null);
            setPaymentSubmitting(false);
            setPaymentMessage(null);
          }
        },
        handler: async (paymentResponse) => {
          checkoutFinished = true;
          setPaymentSubmitting(true);
          setPaymentOverlayStep("verifying");
          setPaymentMessage("Preparing your receipt...");

          try {
            await verifyPayment(order.internalOrderId, paymentResponse);
            const confirmation = buildOrderConfirmationFromCheckout({
              deliveryAddress,
              items,
              order,
              orderNotes,
              packagingFee,
              paymentResponse,
              savings,
              shippingFee,
              subtotal,
              total
            });

            redirectRef.current = true;
            saveLatestOrderConfirmation(confirmation);
            clearCart();
            router.replace("/app/order-confirmation/");
          } catch (error) {
            setPaymentOverlayStep(null);
            setPaymentMessage(error instanceof Error ? error.message : "Payment verification failed.");
          } finally {
            setPaymentSubmitting(false);
          }
        }
      };

      const razorpay = new window.Razorpay(checkoutOptions);
      razorpay.on("payment.failed", (response: RazorpayEventResponse) => {
        checkoutFinished = true;
        setCheckoutStep("delivery");
        setPaymentSubmitting(false);
        setPaymentOverlayStep(null);
        setProfileError(getPaymentFailureMessage(response));
        setPaymentMessage(null);
      });

      razorpay.open();
      setPaymentSubmitting(false);
      setPaymentMessage(null);
    } catch (error) {
      setCheckoutStep("delivery");
      setPaymentOverlayStep(null);
      setPaymentSubmitting(false);
      setPaymentMessage(null);
      setProfileError(error instanceof Error ? error.message : "Unable to start payment.");
    }
  }

  useEffect(() => {
    if (
      !user?.uid ||
      profileLoading ||
      profileResolvedUserId !== user.uid ||
      savedAddress ||
      addressSheetOpen
    ) {
      return;
    }

    if (autoPromptedAddressUserIdRef.current === user.uid) {
      return;
    }

    autoPromptedAddressUserIdRef.current = user.uid;
    setAddressSheetOpen(true);
  }, [addressSheetOpen, profileLoading, profileResolvedUserId, savedAddress, user?.uid]);

  return (
    <MobileAppShell showBottomNav={false}>
      {paymentOverlayStep ? (
        <MobileReceiptOverlay
          customerName={(activeAddress?.fullName ?? "").trim() || "there"}
          itemCount={totalItems}
        />
      ) : null}

      <div className="px-4 pb-[calc(6.9rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#2f342d] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
            aria-label="Back"
          >
            <ArrowLeftIcon />
          </button>
          <div className="text-center">
            <Image src="/eshwelogo-transparent.png" alt="eshwe" width={64} height={64} className="mx-auto h-14 w-14 object-contain" />
          </div>
          <span className="h-11 w-11" />
        </div>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(135deg,rgba(255,250,242,0.97)_0%,rgba(247,237,224,0.94)_100%)] p-5 shadow-[0_18px_36px_rgba(94,104,79,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Review & pay</p>
              <h1 className="brand-copy mt-3 text-[1.9rem] leading-tight text-[#2f342d]">Complete your order</h1>
            </div>
            <div className="rounded-[1.2rem] bg-white/75 px-4 py-3 text-right shadow-[inset_0_0_0_1px_rgba(234,223,206,0.9)]">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">Total due</p>
              <p className="mt-1 text-[1.25rem] font-semibold text-[#2b2a29]">{formatCurrency(total)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
            <MobileStepPill
              step="bag"
              active={checkoutStep === "bag"}
              complete={checkoutStep !== "bag"}
              onClick={() => handleStepNavigation("bag")}
            />
            <span className="h-px rounded-full bg-[#d8ccb8]" />
            <MobileStepPill
              step="delivery"
              active={checkoutStep === "delivery" || checkoutStep === "address"}
              complete={checkoutStep === "pay" || Boolean(activeAddress)}
              onClick={() => handleStepNavigation("delivery")}
            />
            <span className="h-px rounded-full bg-[#d8ccb8]" />
            <MobileStepPill
              step="pay"
              active={checkoutStep === "pay"}
              complete={paymentOverlayStep === "verifying"}
              onClick={() => handleStepNavigation("pay")}
            />
          </div>

        </section>

        {checkoutStep === "bag" ? (
          <section className="mt-4 rounded-[1.85rem] border border-[#cbbb9e] bg-white/88 p-5 shadow-[0_16px_34px_rgba(94,104,79,0.1)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Shopping bag</p>
                <h1 className="brand-copy mt-3 text-[1.8rem] leading-tight text-[#2f342d]">
                  Review your order
                </h1>
              </div>
              <Link
                href={buildAppSearchHref()}
                className="brand-caption inline-flex min-w-[7.2rem] items-center justify-center whitespace-nowrap rounded-full border border-[#d7ccb9] px-4 py-2.5 text-[0.56rem] font-semibold tracking-[0.14em] text-[#56624d]"
              >
                ADD MORE
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <MobileCheckoutItem
                  key={item.sku}
                  item={item}
                  onDecrease={() => updateQuantity(item.sku, item.quantity - 1)}
                  onIncrease={() => updateQuantity(item.sku, item.quantity + 1)}
                  onRemove={() => removeItem(item.sku)}
                />
              ))}
            </div>

            {hasUnavailableItems ? (
              <p className="mt-4 rounded-[1.1rem] bg-[#fff1ea] px-4 py-3 text-[0.9rem] leading-6 text-[#a8574d]">
                One or more sarees are no longer available. Please update the bag before paying.
              </p>
            ) : null}
          </section>
        ) : null}

        {showVerificationStep ? (
          <>
            <section
              ref={deliverySectionRef}
              className="mt-4 rounded-[1.85rem] border border-[#cbbb9e] bg-white/88 p-5 shadow-[0_16px_34px_rgba(94,104,79,0.1)]"
            >
              <div>
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Delivery details</p>
                <p className="mt-2 text-[0.95rem] text-[#68735e]">Enter your mobile number to continue.</p>
              </div>

              {profileError ? <p className="mt-3 text-[0.9rem] text-[#a8574d]">{profileError}</p> : null}

              <div className="mt-4 rounded-[1.45rem] border border-[#eee4d6] bg-[linear-gradient(180deg,#fffdf8_0%,#faf6ef_100%)] px-4 py-4 text-[0.94rem] leading-7 text-[#54604c]">
                <label className="block">
                  <span className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">10-digit phone number</span>
                  <input
                    value={signInPhone}
                    onChange={(event) => {
                      setSignInPhone(normalizePhoneInput(event.target.value));
                      if (profileError) {
                        setProfileError(null);
                      }
                    }}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="9876543210"
                    className="h-12 w-full rounded-[1rem] border border-[#d9ccb8] bg-white px-4 text-[16px] text-[#2b2a29] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]"
                  />
                </label>
              </div>
            </section>
          </>
        ) : null}

        {showAddressStep ? (
          <>
            <section
              ref={deliverySectionRef}
              className={`mt-4 rounded-[1.85rem] border bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)] ${
                checkoutStep === "address" ? "border-[#cbbb9e] shadow-[0_16px_34px_rgba(94,104,79,0.1)]" : "border-[#eadfce]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Address details</p>
                  <p className="mt-2 text-[0.95rem] text-[#68735e]">Review the saved address or add a new one for this order.</p>
                </div>
                {user ? (
                  <button
                    type="button"
                    onClick={() => setAddressSheetOpen(true)}
                    disabled={profileLoading && !savedAddress}
                    className="brand-caption rounded-full bg-[#5e684f] px-4 py-2.5 text-[0.62rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
                  >
                    {profileLoading && !savedAddress ? "ADDRESS" : savedAddress ? "EDIT" : "ADD"}
                  </button>
                ) : null}
              </div>

              {profileError ? <p className="mt-3 text-[0.9rem] text-[#a8574d]">{profileError}</p> : null}

              {user ? (
                profileLoading ? (
                  <div className="mt-4 rounded-[1.45rem] border border-[#eee4d6] bg-[linear-gradient(180deg,#fffdf8_0%,#faf6ef_100%)] px-4 py-4 text-[0.94rem] leading-7 text-[#54604c]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">Verified mobile</p>
                    <p className="mt-1 text-[0.98rem] font-medium text-[#2f342d]">{resolveVerifiedPhone(user.phoneNumber)}</p>
                    <p className="mt-3 text-[0.94rem] text-[#68735e]">Verifying user and loading saved address...</p>
                  </div>
                ) : savedAddress ? (
                  <div className="mt-4 rounded-[1.45rem] border border-[#eee4d6] bg-[linear-gradient(180deg,#fffdf8_0%,#faf6ef_100%)] px-4 py-4 text-[0.96rem] leading-7 text-[#54604c]">
                    <div className="mb-3 rounded-[1rem] bg-[#f5f0e7] px-3.5 py-3">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">Verified mobile</p>
                      <p className="mt-1 text-[0.98rem] font-medium text-[#2f342d]">{savedAddress.phone}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="brand-copy text-[1.25rem] text-[#2f342d]">{savedAddress.fullName}</p>
                      <span className="rounded-full bg-[#eef4e7] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#5e684f]">
                        Primary
                      </span>
                    </div>
                    <p className="mt-2">{savedAddress.address}</p>
                    <p>
                      {savedAddress.city}, {savedAddress.state} - {savedAddress.pincode}
                    </p>
                    <p>{savedAddress.phone}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.45rem] border border-[#eee4d6] bg-[linear-gradient(180deg,#fffdf8_0%,#faf6ef_100%)] px-4 py-4 text-[0.94rem] leading-7 text-[#54604c]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">Verified mobile</p>
                    <p className="mt-1 text-[0.98rem] font-medium text-[#2f342d]">{resolveVerifiedPhone(user.phoneNumber)}</p>
                    <p className="mt-3 text-[0.94rem] text-[#68735e]">No saved address found. Add your address to continue.</p>
                  </div>
                )
              ) : null}
            </section>
          </>
        ) : null}

        {checkoutStep === "pay" ? (
          <>
            <section
              ref={paySectionRef}
              className="mt-4 rounded-[1.85rem] border border-[#cbbb9e] bg-white/88 p-5 shadow-[0_16px_34px_rgba(94,104,79,0.1)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Review & pay</p>
                  <p className="mt-2 text-[0.95rem] text-[#68735e]">Check totals now. Payment opens in the mobile Razorpay flow.</p>
                </div>
                <span className="inline-flex h-10 min-w-[4.9rem] items-center justify-center whitespace-nowrap rounded-full bg-[#f1f5eb] px-3 text-[0.76rem] font-semibold text-[#5e684f]">
                  {totalItems} item{totalItems === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-[0.96rem] text-[#5f6259]">
                <SummaryRow label={`Subtotal (${totalItems} item${totalItems === 1 ? "" : "s"})`} value={formatCurrency(subtotal)} />
                <SummaryRow label="Shipping" value={shippingFee === 0 ? "Free" : formatCurrency(shippingFee)} />
                <SummaryRow label="Packaging" value={packagingFee === 0 ? "Free" : formatCurrency(packagingFee)} />
                {savings > 0 ? <SummaryRow label="Savings" value={`-${formatCurrency(savings)}`} valueClassName="text-[#b85b52]" /> : null}
              </div>

              <div className="mt-5 rounded-[1.35rem] bg-[#faf6ef] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="brand-copy text-[1.5rem] text-[#2f342d]">Total</span>
                  <span className="text-[1.65rem] font-semibold text-[#2b2a29]">{formatCurrency(total)}</span>
                </div>
                <p className="mt-2 text-[0.88rem] text-[#8e9289]">Inclusive of all taxes</p>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-[0.9rem] font-medium text-[#4f5942]">Order note</span>
                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-[1.15rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 py-3 text-[16px] leading-[1.45] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                />
              </label>

              {paymentMessage && !paymentOverlayStep ? (
                <p className="mt-3 text-center text-[0.88rem] text-[#68735e]">{paymentMessage}</p>
              ) : null}
            </section>

            {activeAddress ? (
              <section className="mt-4 rounded-[1.6rem] border border-[#eadfce] bg-white/88 px-4 py-4 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">Delivery to</p>
                    <p className="mt-1 text-[1rem] font-semibold text-[#2f342d]">{activeAddress.fullName}</p>
                    <p className="mt-1 text-[0.9rem] leading-6 text-[#68735e]">
                      {activeAddress.city}, {activeAddress.state} - {activeAddress.pincode}
                    </p>
                    <p className="text-[0.9rem] leading-6 text-[#68735e]">{activeAddress.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepNavigation("delivery")}
                    className="brand-caption rounded-full border border-[#d7ccb9] px-3 py-2 text-[0.56rem] font-semibold tracking-[0.14em] text-[#56624d]"
                  >
                    CHANGE
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {recommendations.length > 0 ? (
          <MobileRecommendationSection
            title="You may also like"
            products={visibleRecommendations}
            viewAllHref={checkoutRecommendationHref}
          />
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.95rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[430px] rounded-[1.9rem] border border-[rgba(214,203,185,0.82)] bg-[rgba(255,251,245,0.95)] px-4 py-3 shadow-[0_20px_42px_rgba(47,40,32,0.14)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => void handlePrimaryCheckoutAction()}
            disabled={
              (checkoutStep === "bag" && items.length === 0) ||
              (checkoutStep === "address" && (profileLoading || profileSaving)) ||
              (checkoutStep === "pay" && (!canProceed || paymentSubmitting || profileSaving))
            }
            className="brand-caption inline-flex h-14 w-full items-center justify-center rounded-[1.15rem] bg-[#5e684f] px-5 text-[0.66rem] font-semibold tracking-[0.15em] text-[#fbf4e8] disabled:opacity-55"
          >
            {primaryButtonLabel}
          </button>
        </div>
      </div>

      <MobileAddressSheet
        open={addressSheetOpen}
        title={savedAddress ? "Edit delivery address" : "Add delivery address"}
        form={addressForm}
        pending={profileSaving}
        verifiedPhone={resolveVerifiedPhone(user?.phoneNumber, addressForm.phone)}
        onClose={() => setAddressSheetOpen(false)}
        onFieldChange={(field, value) =>
          setAddressForm((currentForm) => ({
            ...currentForm,
            [field]: value
          }))
        }
        onSave={() => void handleSaveAddress()}
      />
    </MobileAppShell>
  );
}

export function MobileAppOrderConfirmationPage() {
  const [confirmation, setConfirmation] = useState<OrderConfirmationData | null>(null);
  const displayOrderId = confirmation ? formatOrderConfirmationId(confirmation.internalOrderId) : "-";

  useEffect(() => {
    setConfirmation(readLatestOrderConfirmation());
  }, []);

  return (
    <MobileAppShell showBottomNav={false}>
      <div className="px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="rounded-[2rem] border border-[#eadfce] bg-white/90 p-6 text-center shadow-[0_18px_42px_rgba(94,104,79,0.08)]">
          <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#eef4e7] text-[#5e684f]">
            <CheckIcon />
          </span>
          <p className="brand-caption mt-5 text-[0.68rem] font-semibold tracking-[0.18em] text-[#7d876f]">ORDER CONFIRMED</p>
          <h1 className="brand-copy mt-4 text-[2rem] leading-tight text-[#2f342d]">Thank you for your order.</h1>
          <p className="mt-3 text-[0.98rem] leading-7 text-[#68735e]">
            {confirmation
              ? `Paid on ${formatOrderConfirmationDateOnly(confirmation.createdAtIso)}.`
              : "Your latest receipt snapshot is not available in this tab."}
          </p>
        </div>

        {confirmation ? (
          <>
            <section className="mt-4 rounded-[1.8rem] border border-[#eadfce] bg-white/88 p-5 shadow-[0_12px_28px_rgba(94,104,79,0.06)]">
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Order ID" value={displayOrderId} />
                <InfoCard label="Status" value={formatOrderConfirmationPaymentStatus(confirmation.paymentStatus)} />
                <InfoCard label="Placed" value={formatOrderConfirmationDateOnly(confirmation.createdAtIso)} />
                <InfoCard label="Items" value={`${confirmation.items.length}`} />
              </div>

              <div className="mt-5 rounded-[1.35rem] bg-[#faf6ef] px-4 py-4 text-left text-[0.96rem] leading-7 text-[#54604c]">
                <p className="brand-copy text-[1.25rem] text-[#2f342d]">{confirmation.customer.fullName}</p>
                <p className="mt-2">{confirmation.customer.address}</p>
                <p>
                  {confirmation.customer.city}, {confirmation.customer.state} - {confirmation.customer.pincode}
                </p>
                <p>{confirmation.customer.phone}</p>
              </div>

              <div className="mt-5 space-y-3">
                {confirmation.items.map((item) => (
                  <div key={`${item.sku}-${item.quantity}`} className="rounded-[1.2rem] bg-[#faf6ef] px-4 py-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="brand-copy text-[1.1rem] text-[#2f342d]">{item.name}</p>
                        <p className="mt-1 text-[0.9rem] text-[#68735e]">
                          {item.sku}
                          {item.color ? ` · ${item.color}` : ""}
                        </p>
                      </div>
                      <p className="text-[1rem] font-semibold text-[#2b2a29]">
                        {formatCurrency((item.unitPrice ?? 0) * item.quantity)}
                      </p>
                    </div>
                    <p className="mt-2 text-[0.9rem] text-[#68735e]">Qty {item.quantity}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => openOrderReceiptPreview(confirmation)}
                  className="brand-caption inline-flex flex-1 items-center justify-center rounded-[1.1rem] bg-[#5e684f] px-5 py-3.5 text-[0.66rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
                >
                  VIEW RECEIPT
                </button>
                <Link
                  href={buildAppHomeHref()}
                  className="brand-caption inline-flex flex-1 items-center justify-center rounded-[1.1rem] border border-[#d7ccb9] px-5 py-3.5 text-[0.66rem] font-semibold tracking-[0.14em] text-[#56624d]"
                >
                  CONTINUE
                </Link>
              </div>
            </section>
          </>
        ) : (
          <EmptyStateCard
            title="Confirmation loaded without receipt details"
            description="If you just completed checkout, go back to the collection and place the order again after refreshing the session."
            actionHref={buildAppHomeHref()}
            actionLabel="Back to home"
          />
        )}
      </div>
    </MobileAppShell>
  );
}

function MobileHomeHeader({
  totalItems,
  onOpenMenu
}: {
  totalItems: number;
  onOpenMenu: () => void;
}) {
  return (
    <div className="relative flex min-h-[4.5rem] items-center justify-between gap-3">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7dccd] bg-white/78 text-[#2f342d] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
      </div>

      <Link
        href={buildAppHomeHref()}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
      >
        <Image src="/eshwelogo-transparent.png" alt="eshwe" width={72} height={72} className="h-16 w-16 object-contain" />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href={buildAppSearchHref()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7dccd] bg-white/78 text-[#2f342d] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
          aria-label="Search"
        >
          <SearchIcon />
        </Link>
        <Link
          href={buildAppCheckoutHref()}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7dccd] bg-white/78 text-[#5e684f] shadow-[0_8px_20px_rgba(94,104,79,0.06)]"
          aria-label="Bag"
        >
          <BagOutlineIcon />
          {totalItems > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#a8574d] px-1.5 text-[0.72rem] font-semibold leading-none text-[#fbf4e8] shadow-[0_8px_16px_rgba(89,45,36,0.2)]">
              {totalItems}
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

function MobileMenuSheet({
  open,
  onClose,
  categoryCards
}: {
  open: boolean;
  onClose: () => void;
  categoryCards: CategoryCard[];
}) {
  if (!open) {
    return null;
  }

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Browse">
      <div className="space-y-2">
        <Link href={buildAppSearchHref()} onClick={onClose} className="block rounded-[1.2rem] bg-[#faf6ef] px-4 py-4 text-[1rem] font-medium text-[#2f342d]">
          All products
        </Link>
        <Link href={buildAppSearchHref({ sort: "newest" })} onClick={onClose} className="block rounded-[1.2rem] bg-[#faf6ef] px-4 py-4 text-[1rem] font-medium text-[#2f342d]">
          New arrivals
        </Link>
        {categoryCards.map((card) => (
          <Link
            key={card.id ?? card.title}
            href={buildAppCategoryHref(card.shopFilter || card.title)}
            onClick={onClose}
            className="block rounded-[1.2rem] bg-[#faf6ef] px-4 py-4 text-[1rem] font-medium text-[#2f342d]"
          >
            {card.title}
          </Link>
        ))}
      </div>
    </MobileBottomSheet>
  );
}

function MobileRecommendationSection({
  title,
  products,
  viewAllHref
}: {
  title: string;
  products: Saree[];
  viewAllHref: string;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mt-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#dccfb9]" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#7d876f]">{title}</p>
        <span className="h-px flex-1 bg-[#dccfb9]" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {products.map((product) => (
          <div key={product.id ?? product.sku} className="min-w-0">
            <MobileProductCard product={product} compact slim />
          </div>
        ))}
      </div>
      <Link
        href={viewAllHref}
        className="brand-caption mt-4 inline-flex w-full items-center justify-center rounded-[1rem] border border-[#d7ccb9] px-4 py-3 text-[0.58rem] font-semibold tracking-[0.14em] text-[#56624d]"
      >
        VIEW ALL
      </Link>
    </section>
  );
}

function MobileProductCard({
  product,
  compact = false,
  slim = false
}: {
  product: Saree;
  compact?: boolean;
  slim?: boolean;
}) {
  const { addItem, items, updateQuantity } = useCart();
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);
  const cartQuantity = items.find((item) => item.sku === product.sku)?.quantity ?? 0;
  const canIncreaseQuantity = cartQuantity < getPurchasableQuantityLimit(product.availableStock);

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#eadfce] bg-white/92 shadow-[0_16px_34px_rgba(94,104,79,0.08)]">
      <div className="relative">
        <Link href={buildAppProductHref(product.slug)} className="relative block">
          <div className={slim ? "aspect-[1.06]" : compact ? "aspect-[0.9]" : "aspect-[1]"}>
            <div
              className="absolute inset-0 bg-[#efe5d7]"
              style={buildImageBackgroundStyle(product.primaryImageUrl, {
                focalPosition: "center 18%"
              })}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,49,36,0)_50%,rgba(36,49,36,0.12)_100%)]" />
          </div>
          {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
            <span className="brand-caption absolute left-3 top-3 rounded-full bg-[#5e684f] px-3 py-1.5 text-[0.56rem] font-semibold tracking-[0.12em] text-[#fbf4e8]">
              -{product.discountPercent}%
            </span>
          ) : null}
        </Link>

        <FavoriteToggleButton sku={product.sku} className="absolute right-3 top-3 z-10 h-10 w-10" />
      </div>

      <div className={slim ? "px-3 pb-2.5 pt-2" : "px-3 pb-2.5 pt-2"}>
        <Link href={buildAppProductHref(product.slug)} className="block">
          <h3 className={`brand-copy text-[#2f342d] ${slim ? "text-[0.84rem] leading-[1.08]" : "text-[0.86rem] leading-[1.08]"}`}>{product.name}</h3>
          <p className={`mt-0.5 text-[#68735e] ${slim ? "text-[0.7rem] leading-[1rem]" : "text-[0.72rem] leading-[1rem]"}`}>{getMobileProductLabel(product)}</p>
        </Link>

        <div className={`flex items-end gap-1.5 ${slim ? "mt-1" : "mt-1.25"}`}>
          <span className={slim ? "text-[0.86rem] font-semibold text-[#2b2a29]" : "text-[0.88rem] font-semibold text-[#2b2a29]"}>{formatCurrency(product.price)}</span>
          {typeof product.originalPrice === "number" ? (
            <span className={slim ? "text-[0.68rem] text-[#9a9a93] line-through" : "text-[0.7rem] text-[#9a9a93] line-through"}>{formatCurrency(product.originalPrice)}</span>
          ) : null}
        </div>

        <div className={slim ? "mt-1.25" : "mt-1.5"}>
          {product.status === "out_of_stock" ? (
            <button
              type="button"
              onClick={() => setWaitlistDialogOpen(true)}
              className={`brand-caption inline-flex w-full items-center justify-center rounded-full bg-[#3f4738] px-3.5 font-semibold tracking-[0.11em] text-[#fbf4e8] ${slim ? "h-8.5 text-[0.48rem]" : "h-9 text-[0.5rem]"}`}
            >
              NOTIFY ME
            </button>
          ) : cartQuantity > 0 ? (
            <div className={`grid w-full items-center rounded-full bg-[#5e684f] px-1.5 text-[#fbf4e8] ${slim ? "h-8.5 grid-cols-[1.9rem_1fr_1.9rem]" : "h-9 grid-cols-[2rem_1fr_2rem]"}`}>
              <QuantityButton label="Decrease quantity" onClick={() => updateQuantity(product.sku, cartQuantity - 1)}>
                -
              </QuantityButton>
              <span className={slim ? "text-center text-[0.72rem] font-semibold" : "text-center text-[0.76rem] font-semibold"}>{cartQuantity}</span>
              <QuantityButton
                label="Increase quantity"
                onClick={() => updateQuantity(product.sku, cartQuantity + 1)}
                disabled={!canIncreaseQuantity}
              >
                +
              </QuantityButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addItem(product, 1)}
              className={`brand-caption inline-flex w-full items-center justify-center rounded-full bg-[#5e684f] px-3.5 font-semibold tracking-[0.11em] text-[#fbf4e8] ${slim ? "h-8.5 text-[0.48rem]" : "h-9 text-[0.5rem]"}`}
            >
              ADD TO CART
            </button>
          )}
        </div>
      </div>

      <NotifyWaitlistDialog
        open={waitlistDialogOpen}
        product={waitlistDialogOpen ? product : null}
        onClose={() => setWaitlistDialogOpen(false)}
      />
    </article>
  );
}

function MobileCategoryCard({
  card,
  products
}: {
  card: CategoryCard;
  products: Saree[];
}) {
  const previewProduct = products.find(
    (product) =>
      !isPlaceholderCategoryImage(product.primaryImageUrl) &&
      (matchesIdentifier(product.category, card.shopFilter || card.title) ||
        matchesIdentifier(product.fabric, card.shopFilter || card.title) ||
        matchesIdentifier(product.category, card.title) ||
        matchesIdentifier(product.fabric, card.title))
  );
  const previewImage = !isPlaceholderCategoryImage(card.imageUrl) ? card.imageUrl : previewProduct?.primaryImageUrl;

  return (
    <Link
      href={buildAppCategoryHref(card.shopFilter || card.title)}
      className="relative overflow-hidden rounded-[1.6rem] border border-[#e9dfd1] bg-[#efe5d7] shadow-[0_14px_32px_rgba(94,104,79,0.07)]"
    >
      <div
        className="aspect-[0.82] w-full bg-[#efe5d7]"
        style={{
          ...buildImageBackgroundStyle(previewImage, {
            focalPosition: card.backgroundPosition || "center 12%"
          })
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,23,20,0.02)_0%,rgba(24,23,20,0.12)_56%,rgba(24,23,20,0.42)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-4 pt-8 text-center">
        <p className="brand-copy text-[1.05rem] leading-tight text-[#fffaf2] drop-shadow-[0_2px_10px_rgba(0,0,0,0.24)]">
          {card.title}
        </p>
      </div>
    </Link>
  );
}

function MobileFilterSheet({
  open,
  onClose,
  searchValue,
  category,
  fabric,
  intent,
  sort,
  categoryOptions,
  fabricOptions,
  onChangeSearch,
  onChangeCategory,
  onChangeFabric,
  onChangeIntent,
  onChangeSort,
  onApply,
  onClear
}: {
  open: boolean;
  onClose: () => void;
  searchValue: string;
  category: string;
  fabric: string;
  intent: string;
  sort: SearchSort;
  categoryOptions: string[];
  fabricOptions: string[];
  onChangeSearch: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onChangeFabric: (value: string) => void;
  onChangeIntent: (value: string) => void;
  onChangeSort: (value: SearchSort) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-4">
        <MobileInput label="Search" value={searchValue} onChange={onChangeSearch} />
        <MobileSelect label="Sort" value={sort} options={["relevance", "newest", "price-asc", "price-desc"]} onChange={(value) => onChangeSort(value as SearchSort)} formatLabel={formatSortLabel} />
        <MobileSelect label="Category" value={category} options={["", ...categoryOptions]} onChange={onChangeCategory} />
        <MobileSelect label="Fabric" value={fabric} options={["", ...fabricOptions]} onChange={onChangeFabric} />
        <MobileSelect label="Intent" value={intent} options={["", ...MOBILE_INTENT_OPTIONS]} onChange={onChangeIntent} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onApply}
          className="brand-caption rounded-[1rem] bg-[#5e684f] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
        >
          APPLY
        </button>
        <button
          type="button"
          onClick={onClear}
          className="brand-caption rounded-[1rem] border border-[#d7ccb9] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#56624d]"
        >
          CLEAR
        </button>
      </div>
    </MobileBottomSheet>
  );
}

function MobileAddressSheet({
  open,
  title,
  form,
  pending,
  verifiedPhone,
  onClose,
  onFieldChange,
  onSave
}: {
  open: boolean;
  title: string;
  form: PaymentFormState;
  pending: boolean;
  verifiedPhone: string;
  onClose: () => void;
  onFieldChange: (field: keyof PaymentFormState, value: string) => void;
  onSave: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <MobileBottomSheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-3">
        <MobileInput label="Full name" value={form.fullName} onChange={(value) => onFieldChange("fullName", value)} />
        <MobileInput label="Email" value={form.email} onChange={(value) => onFieldChange("email", value)} />
        <MobileInput label="Phone" value={verifiedPhone} onChange={() => undefined} readOnly />
        <MobileInput label="Address" value={form.address} onChange={(value) => onFieldChange("address", value)} />
        <div className="grid grid-cols-2 gap-3">
          <MobileInput label="City" value={form.city} onChange={(value) => onFieldChange("city", value)} />
          <MobileInput label="State" value={form.state} onChange={(value) => onFieldChange("state", value)} />
        </div>
        <MobileInput label="Pincode" value={form.pincode} onChange={(value) => onFieldChange("pincode", value)} />
      </div>
      <p className="mt-3 text-[0.76rem] leading-6 text-[#7d876f]">
        Mobile number is locked to the verified OTP account. To use a different number, sign in with that number first.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="brand-caption rounded-[1rem] bg-[#5e684f] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
        >
          {pending ? "SAVING" : "SAVE"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="brand-caption rounded-[1rem] border border-[#d7ccb9] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#56624d]"
        >
          CANCEL
        </button>
      </div>
    </MobileBottomSheet>
  );
}

function PageHeading({
  title,
  subtitle,
  eyebrow = "eshwe app"
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  return (
    <div className="rounded-[1.9rem] border border-[#eadfce] bg-white/70 px-5 py-5 shadow-[0_12px_28px_rgba(94,104,79,0.05)]">
      <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">{eyebrow}</p>
      <div className="mt-3">
        <h1 className="brand-copy text-[2rem] leading-tight text-[#2f342d]">{title}</h1>
        <p className="mt-3 text-[0.94rem] leading-7 text-[#68735e]">{subtitle}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  actionHref,
  actionLabel
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <h2 className="brand-copy text-[1.55rem] text-[#2f342d]">{title}</h2>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex items-center gap-1 text-[0.92rem] font-medium text-[#5e684f]">
          <span>{actionLabel}</span>
          <ChevronRightIcon />
        </Link>
      ) : null}
    </div>
  );
}

function MobileHomeSection({
  title,
  actionHref,
  actionLabel,
  eyebrow,
  tone,
  children
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  tone: "warm" | "plain" | "sage";
  children: ReactNode;
}) {
  const shellClassName =
    tone === "warm"
      ? "mt-6 -mx-4 bg-[linear-gradient(180deg,#fff9f0_0%,#f7efe3_100%)] px-4 py-5"
      : tone === "sage"
        ? "mt-7 -mx-4 bg-[linear-gradient(180deg,rgba(244,247,238,0.98)_0%,rgba(235,241,227,0.96)_100%)] px-4 py-5"
        : "mt-7 pt-5";

  return (
    <section className={shellClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8a9078]">{eyebrow}</p>
          ) : null}
          <h2 className="brand-copy text-[1.55rem] text-[#2f342d]">{title}</h2>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="mt-1 inline-flex items-center gap-1 text-[0.92rem] font-medium text-[#5e684f]">
            <span>{actionLabel}</span>
            <ChevronRightIcon />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MobileProductPreviewGrid({
  products,
  sectionKey
}: {
  products: Saree[];
  sectionKey: string;
}) {
  const previewProducts = products.slice(0, 4);

  if (previewProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {previewProducts.map((product) => (
        <MobileProductCard key={`${product.id ?? product.sku}-${sectionKey}`} product={product} compact />
      ))}
    </div>
  );
}

function BenefitTile({
  title,
  description,
  icon
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.35rem] bg-[#faf6ef] px-3 py-3 text-center">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f6efe2] text-[#758060]">
        {icon}
      </span>
      <p className="mt-2 text-[0.82rem] font-semibold text-[#2f342d]">{title}</p>
      <p className="mt-1 text-[0.74rem] leading-5 text-[#68735e]">{description}</p>
    </div>
  );
}

function SimpleTrustPill({
  title,
  icon
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[0.9rem] bg-[#faf6ef] px-1.5 py-2 text-center shadow-[inset_0_0_0_1px_rgba(238,228,214,0.9)]">
      <span className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f3ecdf] text-[#758060]">
        {icon}
      </span>
      <p className="mt-1 text-[0.6rem] font-semibold leading-[1.15] text-[#354233]">{title}</p>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="mt-5 rounded-[1.8rem] border border-dashed border-[#dccfb9] bg-[#fffaf2] px-5 py-8 text-center shadow-[0_10px_24px_rgba(94,104,79,0.04)]">
      <h2 className="brand-copy text-[1.7rem] text-[#2f342d]">{title}</h2>
      <p className="mt-3 text-[0.96rem] leading-7 text-[#68735e]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="brand-caption mt-5 inline-flex rounded-[1rem] bg-[#5e684f] px-5 py-3 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}

function SignInCard({
  title,
  description,
  actionLabel,
  onAction,
  disabled = false
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="mt-5 rounded-[1.9rem] border border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,252,246,0.96)_0%,rgba(248,240,229,0.94)_100%)] p-5 shadow-[0_16px_34px_rgba(94,104,79,0.08)]">
      <h2 className="brand-copy text-[1.7rem] text-[#2f342d]">{title}</h2>
      <p className="mt-3 text-[0.96rem] leading-7 text-[#68735e]">{description}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="brand-caption mt-5 inline-flex rounded-[1rem] bg-[#5e684f] px-5 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
      >
        {actionLabel}
      </button>
    </section>
  );
}

function MobileBottomSheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(36,49,36,0.3)] backdrop-blur-sm" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
        <div
          className="mx-auto max-w-[430px] rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffaf2_0%,#f8f0e4_100%)] px-5 pb-5 pt-3 shadow-[0_-18px_48px_rgba(47,40,32,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto h-1.5 w-16 rounded-full bg-[#d8ccb8]" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="brand-copy text-[1.7rem] text-[#2f342d]">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3eee3] text-[#5e684f]"
              aria-label={`Close ${title}`}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="mt-5 max-h-[78svh] overflow-y-auto overscroll-contain pr-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function MiniTrustTile({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-[1.1rem] bg-[#faf6ef] px-3 py-3 text-center shadow-[inset_0_0_0_1px_rgba(238,228,214,0.9)]">
      <p className="text-[0.78rem] font-semibold text-[#354233]">{title}</p>
      <p className="mt-1 text-[0.72rem] leading-5 text-[#7b7b72]">{subtitle}</p>
    </div>
  );
}

function MobileInput({
  label,
  value,
  onChange,
  readOnly = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className={`h-12 w-full rounded-[1rem] border border-[#ddd1c0] px-4 text-[16px] leading-tight text-[#2b2a29] outline-none ${
          readOnly ? "bg-[#f3eee4] text-[#6d725f]" : "bg-[#fbf7ef] focus:border-[#5e684f]"
        }`}
      />
    </label>
  );
}

function MobileSelect({
  label,
  value,
  options,
  onChange,
  formatLabel
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatLabel?: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 text-[16px] leading-tight text-[#2b2a29] outline-none focus:border-[#5e684f]"
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option ? (formatLabel ? formatLabel(option) : option) : "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActiveFilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full bg-[#f1eee7] px-3 py-1.5 text-[0.76rem] font-medium text-[#4f5942]"
    >
      <span>{label}</span>
      <CloseIcon small />
    </button>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

function QuantityButton({
  label,
  children,
  onClick,
  disabled = false
}: {
  label: string;
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fbf4e8]/14 text-[1rem] leading-none text-[#fbf4e8] disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function DetailFactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-[#faf6ef] px-4 py-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f]">{label}</p>
      <p className="mt-2 text-[0.96rem] leading-6 text-[#2f342d]">{value}</p>
    </div>
  );
}

function DetailTipsCard({
  title,
  subtitle,
  tips
}: {
  title: string;
  subtitle: string;
  tips: string[];
}) {
  return (
    <div className="rounded-[1.25rem] bg-[#faf6ef] px-4 py-4">
      <p className="text-[0.96rem] font-semibold text-[#2f342d]">{title}</p>
      <p className="mt-1 text-[0.84rem] leading-6 text-[#68735e]">{subtitle}</p>
      <div className="mt-3 grid gap-2.5">
        {tips.map((tip, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5e684f]" />
            <p className="text-[0.9rem] leading-6 text-[#51604a]">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMobileBrowseChipCount({
  chip,
  products,
  query
}: {
  chip: string;
  products: Saree[];
  query: string;
}) {
  if (chip === "All") {
    return products.filter((product) => !query || matchesProductSearch(product, query)).length;
  }

  return products.filter((product) => {
    if (query && !matchesProductSearch(product, query)) {
      return false;
    }

    const matchingIntent = MOBILE_INTENT_OPTIONS.some((option) => matchesIdentifier(option, chip) && matchesProductIntent(product, option));
    return (
      matchesIdentifier(product.category, chip) ||
      matchesIdentifier(product.fabric, chip) ||
      matchingIntent
    );
  }).length;
}

function isPlaceholderCategoryImage(imageUrl?: string | null) {
  const normalized = (imageUrl ?? "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return normalized.endsWith("/eshwelogo.png") || normalized.endsWith("/eshwelogo-transparent.png");
}

function MobileCheckoutItem({
  item,
  onDecrease,
  onIncrease,
  onRemove
}: {
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const canIncreaseQuantity = item.quantity < getPurchasableQuantityLimit(item.availableStock);

  return (
    <article className="grid grid-cols-[4.8rem_minmax(0,1fr)] gap-3 rounded-[1.35rem] bg-[#faf6ef] p-3">
      <div className="aspect-square rounded-[1rem] bg-[#efe5d7]" style={buildImageBackgroundStyle(item.primaryImageUrl)} />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="brand-copy text-[1.2rem] leading-tight text-[#2f342d]">{item.name}</p>
            <p className="mt-1 text-[0.88rem] text-[#68735e]">{getMobileProductLabel(item)}</p>
          </div>
          <p className="text-[1rem] font-semibold text-[#2b2a29]">{formatCurrency(item.price * item.quantity)}</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="grid w-[7.7rem] grid-cols-[2.1rem_1fr_2.1rem] items-center rounded-[0.95rem] bg-[#5e684f] px-1 py-1 text-[#fbf4e8]">
            <QuantityButton label="Decrease quantity" onClick={onDecrease}>
              -
            </QuantityButton>
            <span className="text-center text-[0.84rem] font-semibold">{item.quantity}</span>
            <QuantityButton label="Increase quantity" onClick={onIncrease} disabled={!canIncreaseQuantity}>
              +
            </QuantityButton>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="brand-caption rounded-full border border-[#d7ccb9] px-3 py-2 text-[0.54rem] font-semibold tracking-[0.12em] text-[#8d5c56]"
          >
            REMOVE
          </button>
        </div>
      </div>
    </article>
  );
}

function MobileStepPill({
  step,
  active,
  complete = false,
  onClick
}: {
  step: "bag" | "delivery" | "pay";
  active: boolean;
  complete?: boolean;
  onClick?: () => void;
}) {
  const label = step === "bag" ? "Bag" : step === "delivery" ? "Delivery" : "Pay";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.2rem] border px-3 py-3 text-center ${
        active
          ? "border-[#5e684f] bg-[#5e684f] text-[#fbf4e8]"
          : complete
            ? "border-[#d7ccb9] bg-[#eef1e8] text-[#4f5942]"
            : "border-[#e5dbc9] bg-white/72 text-[#7b7b72]"
      } transition-colors duration-200`}
    >
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{label}</span>
    </button>
  );
}

function MobileReceiptOverlay({
  customerName,
  itemCount
}: {
  customerName: string;
  itemCount: number;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(251,244,232,0.84)] px-4 backdrop-blur-[10px]">
      <div className="w-full max-w-[430px] rounded-[2rem] border border-[#ddd0bc] bg-[linear-gradient(180deg,rgba(255,250,242,0.98)_0%,rgba(247,237,224,0.96)_100%)] px-6 py-8 shadow-[0_30px_100px_rgba(94,104,79,0.18)]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-[#dcc9ad] bg-[linear-gradient(135deg,#fff3df_0%,#efd8ab_100%)] shadow-[0_18px_40px_rgba(176,111,61,0.16)]">
            <Image src="/eshwelogo-transparent.png" alt="Eshwe" width={64} height={64} className="h-16 w-16 object-contain" priority />
          </div>
          <p className="brand-caption mt-5 text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">PAYMENT RECEIVED</p>
          <h2 className="brand-copy mt-4 text-[2rem] leading-tight text-[#2b2a29]">Preparing your receipt.</h2>
          <p className="mt-4 text-[0.96rem] leading-7 text-[#667056]">
            Payment confirmed for {customerName}. We are verifying {itemCount} item{itemCount === 1 ? "" : "s"} now.
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-[18rem]">
          <div className="relative rounded-[1.8rem] border border-[#d7ccb9] bg-[#667056] px-6 pb-6 pt-5 shadow-[0_22px_45px_rgba(94,104,79,0.2)]">
            <div className="mx-auto h-2 w-28 rounded-full bg-[rgba(255,250,242,0.26)]" />
            <div className="absolute left-1/2 top-[3.2rem] h-3 w-44 -translate-x-1/2 rounded-full bg-[rgba(35,42,28,0.18)] blur-md" />
            <div className="receipt-printer-card absolute left-1/2 top-[3.2rem] w-[78%] -translate-x-1/2 overflow-hidden rounded-b-[1.3rem] rounded-t-[0.8rem] border border-[#eadfce] bg-[#fffaf2] shadow-[0_18px_34px_rgba(47,40,32,0.16)]">
              <div className="receipt-shine h-2 w-full bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0)_100%)]" />
              <div className="space-y-3 px-5 pb-5 pt-4">
                <div className="flex items-center justify-between">
                  <span className="h-2.5 w-20 rounded-full bg-[#d8cbb7]" />
                  <span className="h-2.5 w-14 rounded-full bg-[#ece3d6]" />
                </div>
                <div className="h-px w-full bg-[#ece1d3]" />
                <div className="space-y-2">
                  <span className="block h-2.5 w-full rounded-full bg-[#e6dbc9]" />
                  <span className="block h-2.5 w-[82%] rounded-full bg-[#e6dbc9]" />
                  <span className="block h-2.5 w-[65%] rounded-full bg-[#efe6d9]" />
                </div>
              </div>
            </div>
            <div className="pt-44">
              <div className="grid grid-cols-3 gap-2">
                <ReceiptStatusPill label="Payment" value="Paid" />
                <ReceiptStatusPill label="Receipt" value="Printing" />
                <ReceiptStatusPill label="Next" value="Preview" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f]" />
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f] [animation-delay:180ms]" />
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f] [animation-delay:360ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptStatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[rgba(255,250,242,0.14)] bg-[rgba(255,250,242,0.1)] px-2 py-3 text-center">
      <p className="text-[0.54rem] font-semibold tracking-[0.14em] text-[rgba(255,250,242,0.72)]">{label}</p>
      <p className="mt-1 text-[0.74rem] font-medium text-[#fffaf2]">{value}</p>
    </div>
  );
}

function TrustRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.2rem] bg-[#faf6ef] px-4 py-4">
      <p className="text-[0.96rem] font-semibold text-[#2f342d]">{title}</p>
      <p className="mt-1 text-[0.9rem] leading-6 text-[#68735e]">{description}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-[#faf6ef] px-4 py-4 text-left">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7d876f]">{label}</p>
      <p className="mt-2 text-[1rem] font-medium text-[#2f342d]">{value}</p>
    </div>
  );
}

function buildMobileProductFacts(product: Saree) {
  return [
    { label: "Category", value: product.category },
    { label: "SKU", value: product.sku },
    { label: "Length", value: product.length || defaultProductLength }
  ];
}

function buildMobileMaterialCareFacts(product: Saree) {
  return [
    { label: "Material", value: product.fabric },
    { label: "Wash", value: product.washCare || defaultWashCare }
  ];
}

function buildImageBackgroundStyle(
  imageUrl?: string | null,
  options?: {
    focalPosition?: string;
    backgroundSize?: string;
  }
) {
  if (isPlaceholderCategoryImage(imageUrl)) {
    return {
      backgroundImage: imageUrl
        ? `url('${imageUrl}'), linear-gradient(180deg, #f4eadc 0%, #e8dac6 100%)`
        : "linear-gradient(180deg, #f4eadc 0%, #e8dac6 100%)",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat, no-repeat",
      backgroundSize: "68% auto, cover"
    };
  }

  return {
    backgroundImage: imageUrl
      ? `linear-gradient(180deg, rgba(255,249,236,0.05), rgba(43,24,14,0.1)), url('${imageUrl}')`
      : "linear-gradient(180deg, #f1e7da 0%, #d6cab8 100%)",
    backgroundPosition: options?.focalPosition || "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: options?.backgroundSize || "cover"
  };
}

function renderCategoryIcon(category: string) {
  const normalized = category.trim().toLowerCase();

  if (normalized.includes("kanchi")) {
    return <LeafOutlineIcon />;
  }

  if (normalized.includes("sungudi")) {
    return <FlowerIcon />;
  }

  if (normalized.includes("tissue")) {
    return <WaveIcon />;
  }

  if (normalized.includes("mul")) {
    return <CottonIcon />;
  }

  if (normalized.includes("soft silk")) {
    return <SparkleIcon />;
  }

  return <DrapeIcon />;
}

function buildGuestDeliveryAddress(form: PaymentFormState, verifiedPhone?: string | null) {
  const lockedPhone = resolveVerifiedPhone(verifiedPhone, form.phone);

  if (
    !form.fullName.trim() ||
    !form.email.trim() ||
    !lockedPhone ||
    !form.address.trim() ||
    !form.city.trim() ||
    !form.state.trim() ||
    !form.pincode.trim()
  ) {
    return null;
  }

  return {
    ...form,
    address: form.address.trim(),
    city: form.city.trim(),
    email: form.email.trim(),
    fullName: form.fullName.trim(),
    phone: lockedPhone,
    pincode: form.pincode.trim(),
    state: form.state.trim()
  };
}

function buildSingleAddress(form: PaymentFormState, verifiedPhone?: string | null) {
  const normalized = buildGuestDeliveryAddress(form, verifiedPhone);

  if (!normalized) {
    return null;
  }

  return {
    id: "primary",
    label: "Saved Address",
    ...normalized
  } satisfies CustomerAddress;
}

function resolveVerifiedPhone(verifiedPhone: string | null | undefined, fallback = "") {
  const normalizedVerifiedPhone = typeof verifiedPhone === "string" ? verifiedPhone.trim() : "";

  if (normalizedVerifiedPhone) {
    return normalizedVerifiedPhone;
  }

  return fallback.trim();
}

function applyVerifiedPhoneToAddress(address: CustomerAddress, verifiedPhone: string | null | undefined) {
  const lockedPhone = resolveVerifiedPhone(verifiedPhone, address.phone);

  if (lockedPhone === address.phone) {
    return address;
  }

  return {
    ...address,
    phone: lockedPhone
  };
}

async function createOrder(items: CartItem[], deliveryAddress: PaymentFormState, orderNotes: string): Promise<CreateOrderResponse> {
  let response: Response;
  const requestUrl = getRazorpayApiUrl("create-order");
  const headers = await buildProtectedJsonHeadersForPath(requestUrl);

  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity
        })),
        customer: deliveryAddress,
        notes: orderNotes,
        sourcePath: "/app/checkout/"
      })
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Unable to reach the payment server. Check your connection and try again."
    );
  }

  const result = (await response.json().catch(() => ({}))) as Partial<CreateOrderResponse> & { error?: string };

  if (!response.ok) {
    throw new Error(result.error || "Unable to create payment order.");
  }

  if (
    !result ||
    typeof result.keyId !== "string" ||
    typeof result.razorpayOrderId !== "string" ||
    typeof result.internalOrderId !== "string" ||
    typeof result.amount !== "number" ||
    typeof result.currency !== "string" ||
    !Array.isArray(result.lineItems)
  ) {
    throw new Error("Payment order response is invalid.");
  }

  return result as CreateOrderResponse;
}

async function verifyPayment(internalOrderId: string, paymentResponse: RazorpayHandlerResponse) {
  const requestUrl = getRazorpayApiUrl("verify-payment");
  const headers = await buildProtectedJsonHeadersForPath(requestUrl);
  const response = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      internalOrderId,
      ...paymentResponse
    })
  });

  const result = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Payment verification failed.");
  }
}

function buildOrderConfirmationFromCheckout({
  deliveryAddress,
  items,
  order,
  orderNotes,
  packagingFee,
  paymentResponse,
  savings,
  shippingFee,
  subtotal,
  total
}: {
  deliveryAddress: PaymentFormState;
  items: CartItem[];
  order: CreateOrderResponse;
  orderNotes: string;
  packagingFee: number;
  paymentResponse: RazorpayHandlerResponse;
  savings: number;
  shippingFee: number;
  subtotal: number;
  total: number;
}) {
  return {
    createdAtIso: new Date().toISOString(),
    customer: {
      address: deliveryAddress.address,
      city: deliveryAddress.city,
      email: deliveryAddress.email,
      fullName: deliveryAddress.fullName,
      phone: deliveryAddress.phone,
      pincode: deliveryAddress.pincode,
      state: deliveryAddress.state
    },
    internalOrderId: order.internalOrderId,
    items: order.lineItems.map((item) => ({
      color: item.color,
      name: item.name,
      primaryImageUrl: item.primaryImageUrl,
      quantity: item.quantity,
      sku: item.sku,
      unitOriginalPrice: item.unitOriginalPrice,
      unitPrice: item.unitPrice
    })),
    notes: orderNotes.trim(),
    paymentStatus: "captured",
    razorpayOrderId: paymentResponse.razorpay_order_id,
    razorpayPaymentId: paymentResponse.razorpay_payment_id,
    summary: {
      currency: order.currency,
      packagingFee,
      savings,
      shippingFee,
      subtotal,
      total
    }
  } satisfies OrderConfirmationData;
}

function buildOrderConfirmationFromOrder(order: CheckoutOrder) {
  return {
    createdAtIso: toIsoDate(order.createdAt),
    customer: {
      address: order.customer?.address ?? "",
      city: order.customer?.city ?? "",
      email: order.customer?.email ?? "",
      fullName: order.customer?.fullName ?? "",
      phone: order.customer?.phone ?? "",
      pincode: order.customer?.pincode ?? "",
      state: order.customer?.state ?? ""
    },
    internalOrderId: order.id,
    items: (order.cartItems ?? []).map((item) => ({
      color: item.color,
      name: item.name,
      primaryImageUrl: item.primaryImageUrl,
      quantity: item.quantity,
      sku: item.sku,
      unitOriginalPrice: item.unitOriginalPrice,
      unitPrice: item.unitPrice
    })),
    notes: order.notes ?? "",
    paymentStatus: order.paymentStatus ?? "captured",
    razorpayOrderId: order.razorpayOrderId ?? order.receipt ?? "",
    razorpayPaymentId: order.razorpayPaymentId ?? "",
    summary: {
      currency: order.currency ?? "INR",
      packagingFee: order.amountBreakdown?.packagingFee ?? 0,
      savings: order.amountBreakdown?.savings ?? 0,
      shippingFee: order.amountBreakdown?.shippingFee ?? 0,
      subtotal: order.amountBreakdown?.subtotal ?? (order.amountPaise ?? 0) / 100,
      total: order.amountBreakdown?.total ?? (order.amountPaise ?? 0) / 100
    }
  } satisfies OrderConfirmationData;
}

function buildMobileCheckoutRecommendations(products: Saree[], items: CartItem[]) {
  if (items.length === 0) {
    return [];
  }

  const itemSkus = new Set(items.map((item) => item.sku));
  const categoryMatches = new Set(items.map((item) => normalizeOption(item.fabric)));
  const colorMatches = new Set(items.map((item) => normalizeOption(item.color)));

  return products
    .filter((product) => product.status !== "draft")
    .filter((product) => !itemSkus.has(product.sku))
    .map((product) => ({
      product,
      score:
        (categoryMatches.has(normalizeOption(product.fabric)) ? 2 : 0) +
        (colorMatches.has(normalizeOption(product.color)) ? 1 : 0) +
        (product.featured ? 1 : 0)
    }))
    .sort((left, right) => right.score - left.score || productSortByNewest(left.product, right.product))
    .slice(0, 12)
    .map((entry) => entry.product);
}

function sortProducts(products: Saree[], sort: SearchSort, query: string) {
  if (sort === "price-asc") {
    return [...products].sort((left, right) => compareProductsByAvailability(left, right) || left.price - right.price);
  }

  if (sort === "price-desc") {
    return [...products].sort((left, right) => compareProductsByAvailability(left, right) || right.price - left.price);
  }

  if (sort === "newest") {
    return [...products].sort((left, right) => compareProductsByAvailability(left, right) || productSortByNewest(left, right));
  }

  if (!query.trim()) {
    return [...products].sort(
      (left, right) =>
        compareProductsByAvailability(left, right) ||
        Number(right.featured) - Number(left.featured) ||
        productSortByNewest(left, right)
    );
  }

  return [...products].sort((left, right) => {
    const availabilityDifference = compareProductsByAvailability(left, right);

    if (availabilityDifference !== 0) {
      return availabilityDifference;
    }

    const leftMatches = countSearchMatches(left, query);
    const rightMatches = countSearchMatches(right, query);
    return rightMatches - leftMatches || productSortByNewest(left, right);
  });
}

function productSortByNewest(left: Saree, right: Saree) {
  return getTimestampValue(right.createdAt) - getTimestampValue(left.createdAt);
}

function countSearchMatches(product: Saree, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  return [
    product.name,
    product.category,
    product.fabric,
    product.color,
    product.description,
    ...(product.occasionTags ?? [])
  ].reduce((score, value) => {
    const normalizedValue = String(value).toLowerCase();
    return score + (normalizedValue.includes(normalizedQuery) ? 1 : 0);
  }, 0);
}

function uniqueOptions(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeSortValue(value: string | null): SearchSort {
  if (value === "newest" || value === "price-asc" || value === "price-desc") {
    return value;
  }

  return "relevance";
}

function formatSortLabel(value: string) {
  if (value === "price-asc") {
    return "Price: Low to High";
  }

  if (value === "price-desc") {
    return "Price: High to Low";
  }

  if (value === "newest") {
    return "Newest";
  }

  return "Relevance";
}

function getMobileProductLabel(product: { fabric?: string | null; category?: string | null }) {
  return product.fabric?.trim() || product.category?.trim() || "";
}

function matchesIdentifier(left: string, right: string) {
  return normalizeOption(left) === normalizeOption(right);
}

function normalizeOption(value: string) {
  return value.trim().toLowerCase();
}

function getProductGallery(product: Saree) {
  return Array.from(new Set([product.primaryImageUrl, ...product.galleryImageUrls].filter(Boolean)));
}

function getTimestampValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}

function formatDateValue(value: unknown) {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(timestamp));
}

function toIsoDate(value: unknown) {
  const timestamp = getTimestampValue(value);
  return timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function getPaymentFailureMessage(response: RazorpayEventResponse) {
  const error = response.error;

  if (error?.description) {
    return error.description;
  }

  return "Payment failed. Please try again.";
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
      <path d="M8.2 12h8.3" />
    </svg>
  );
}

function SearchIcon({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ProfileOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" />
    </svg>
  );
}

function BagOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 8.2h10l-.8 10H7.8Z" />
      <path d="M9 8.2V7a3 3 0 0 1 6 0v1.2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

function CloseIcon({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3.5 7.5h10v8h-10z" />
      <path d="M13.5 10h3.2l2.3 2.3v3.2h-5.5" />
      <circle cx="7.2" cy="17.2" r="1.5" />
      <circle cx="16.7" cy="17.2" r="1.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 4.2 5.7 6.6v5c0 4 2.5 7.4 6.3 8.7 3.8-1.3 6.3-4.7 6.3-8.7v-5Z" />
      <path d="m9.2 11.8 1.8 1.8 3.6-4" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.5 8.5a8 8 0 0 1 13-2.8L20 8" />
      <path d="M19.5 15.5a8 8 0 0 1-13 2.8L4 16" />
      <path d="M20 8v-4" />
      <path d="M4 20v-4" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 13c0-5.2 4.2-9.5 9.4-9.5H19v4.6C19 13.2 14.7 17.5 9.5 17.5H5Z" />
      <path d="M8 16c.5-3.4 2.4-6.3 5.7-8.8" />
    </svg>
  );
}

function DrapeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 4h7l-3 3 3 3-3 3 3 3-3 4H8Z" />
      <path d="M8 4v16" />
    </svg>
  );
}

function LeafOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 14c0-5 4-9 9-9h3v3c0 5-4 9-9 9H6Z" />
      <path d="M9 14c.8-2.6 2.5-4.9 5.2-6.9" />
    </svg>
  );
}

function FlowerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 5.2c1.6 0 2.8 1.3 2.8 2.9S13.6 11 12 11s-2.8-1.3-2.8-2.9S10.4 5.2 12 5.2Z" />
      <path d="M18.8 10.2c1.6 0 2.8 1.3 2.8 2.8s-1.2 2.8-2.8 2.8S16 14.5 16 13s1.2-2.8 2.8-2.8Z" />
      <path d="M5.2 10.2C6.8 10.2 8 11.5 8 13s-1.2 2.8-2.8 2.8S2.4 14.5 2.4 13s1.2-2.8 2.8-2.8Z" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 17c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
    </svg>
  );
}

function CottonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 10.4a3.3 3.3 0 0 1 3.3-3.3c.5-2 2.2-3.4 4.3-3.4A4.4 4.4 0 0 1 20 8.1c1.2.7 2 2 2 3.5A4.4 4.4 0 0 1 17.6 16H9.1A4.1 4.1 0 0 1 5 12a3.9 3.9 0 0 1 3-3.8Z" />
      <path d="M12 16v4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
      <path d="m18.5 15.5.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m5.5 12.5 4.1 4.1 8.9-9.4" />
    </svg>
  );
}
