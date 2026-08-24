"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  CatalogueProductCard,
  EmptyCatalogueState,
  ProductLoadingGrid
} from "@/components/catalogue-product-card";
import { CategoryCarousel } from "@/components/category-carousel";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { subscribeToCategoryCards } from "@/lib/homepage";
import { subscribeToSarees } from "@/lib/sarees";
import {
  buildShopHref,
  buildShopPath,
  matchesRouteIdentifier,
  resolveShopLocation
} from "@/lib/storefront-routes";
import { useProgressiveProductGrid } from "@/lib/use-progressive-product-grid";
import type { CategoryCard } from "@/types/homepage";
import type { Saree } from "@/types/saree";

const allCategoriesLabel = "ALL CATEGORIES";
const allFabricsLabel = "ALL FABRICS";
const allAvailabilityLabel = "ALL";
const browseAllLabel = "ALL PRODUCTS";
const browseNewArrivalsLabel = "NEW ARRIVALS";
const browseFeaturedLabel = "FEATURED PRODUCTS";

type BrowseOption = {
  kind: "all" | "new-arrivals" | "featured" | "curated";
  title: string;
  shopFilter: string;
};

export function ShopCataloguePage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchBrowse = searchParams.get("browse");
  const searchFilter = searchParams.get("filter");
  const [products, setProducts] = useState<Saree[]>([]);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBrowse, setActiveBrowse] = useState(browseAllLabel);
  const [activeCuratedFilter, setActiveCuratedFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState(allCategoriesLabel);
  const [activeFabric, setActiveFabric] = useState(allFabricsLabel);
  const [activeAvailability, setActiveAvailability] = useState(allAvailabilityLabel);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setLoading(false);
      },
      {}
    );
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards);
    });
  }, []);

  const activeCategoryCards = useMemo(
    () => categoryCards.filter((card) => card.active),
    [categoryCards]
  );

  const browseOptions = useMemo<BrowseOption[]>(
    () => [
      { kind: "all", title: browseAllLabel, shopFilter: "" },
      { kind: "new-arrivals", title: browseNewArrivalsLabel, shopFilter: "" },
      { kind: "featured", title: browseFeaturedLabel, shopFilter: "" },
      ...activeCategoryCards.map((card) => ({
        kind: "curated" as const,
        title: card.title,
        shopFilter: card.shopFilter || card.title
      }))
    ],
    [activeCategoryCards]
  );

  const categories = useMemo(
    () => [
      allCategoriesLabel,
      ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))
    ],
    [products]
  );

  const fabrics = useMemo(
    () => [allFabricsLabel, ...Array.from(new Set(products.map((product) => product.fabric).filter(Boolean)))],
    [products]
  );

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(allCategoriesLabel);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (!fabrics.includes(activeFabric)) {
      setActiveFabric(allFabricsLabel);
    }
  }, [activeFabric, fabrics]);

  useEffect(() => {
    const routeState = resolveShopLocation(pathname, searchBrowse, searchFilter);

    setActiveCategory(allCategoriesLabel);
    setActiveFabric(allFabricsLabel);
    setActiveAvailability(allAvailabilityLabel);

    if (routeState.browse === "new-arrivals") {
      setActiveBrowse(browseNewArrivalsLabel);
      setActiveCuratedFilter("");
      if (searchBrowse || searchFilter) {
        replaceVisibleShopPath(buildShopPath({ browse: "new-arrivals" }));
      }
      return;
    }

    if (routeState.browse === "featured") {
      setActiveBrowse(browseFeaturedLabel);
      setActiveCuratedFilter("");
      if (searchBrowse || searchFilter) {
        replaceVisibleShopPath(buildShopPath({ browse: "featured" }));
      }
      return;
    }

    if (routeState.browse === "curated" && routeState.filter) {
      const matchingOption =
        browseOptions.find(
          (option) =>
            option.kind === "curated" &&
            (matchesRouteIdentifier(option.shopFilter, routeState.filter) ||
              matchesRouteIdentifier(option.title, routeState.filter))
        ) ?? null;

      if (matchingOption) {
        setActiveBrowse(matchingOption.title);
        setActiveCuratedFilter(matchingOption.shopFilter);
        if (searchBrowse || searchFilter) {
          replaceVisibleShopPath(buildShopPath({ browse: "curated", filter: matchingOption.shopFilter }));
        }
        return;
      }

      const matchingCategory =
        categories.find((category) => matchesRouteIdentifier(category, routeState.filter)) ?? null;

      if (matchingCategory) {
        setActiveBrowse(browseAllLabel);
        setActiveCuratedFilter("");
        setActiveCategory(matchingCategory);
        if (searchBrowse || searchFilter) {
          replaceVisibleShopPath(buildShopPath({ browse: "curated", filter: matchingCategory }));
        }
        return;
      }

      const matchingFabric = fabrics.find((fabric) => matchesRouteIdentifier(fabric, routeState.filter)) ?? null;

      if (matchingFabric) {
        setActiveBrowse(browseAllLabel);
        setActiveCuratedFilter("");
        setActiveFabric(matchingFabric);
        if (searchBrowse || searchFilter) {
          replaceVisibleShopPath(buildShopPath({ browse: "curated", filter: matchingFabric }));
        }
        return;
      }
    }

    setActiveBrowse(browseAllLabel);
    setActiveCuratedFilter("");
    if (searchBrowse || searchFilter) {
      replaceVisibleShopPath(buildShopPath());
    }
  }, [browseOptions, categories, fabrics, pathname, searchBrowse, searchFilter]);

  const browseFilteredProducts = products.filter((product) => {
    if (activeBrowse === browseFeaturedLabel) {
      return product.featured;
    }

    if (activeBrowse !== browseAllLabel && activeBrowse !== browseNewArrivalsLabel && activeCuratedFilter) {
      return matchesCuratedFilter(product, activeCuratedFilter);
    }

    return true;
  });

  const filteredProducts = browseFilteredProducts.filter((product) => {
    const matchesCategory =
      activeCategory === allCategoriesLabel || product.category === activeCategory;
    const matchesFabric = activeFabric === allFabricsLabel || product.fabric === activeFabric;
    const matchesAvailability =
      activeAvailability === allAvailabilityLabel ||
      (activeAvailability === "AVAILABLE" && product.status === "active") ||
      (activeAvailability === "OUT OF STOCK" && product.status === "out_of_stock");

    return matchesCategory && matchesFabric && matchesAvailability;
  });
  const { hasMore, loadMoreRef, visibleItemsCount } = useProgressiveProductGrid(
    filteredProducts.length,
    [activeBrowse, activeCuratedFilter, activeCategory, activeFabric, activeAvailability].join("|")
  );
  const visibleFilteredProducts = useMemo(
    () => filteredProducts.slice(0, visibleItemsCount),
    [filteredProducts, visibleItemsCount]
  );
  const hasFilteredProducts = filteredProducts.length > 0;
  const isEmptyFilteredState = !loading && !hasFilteredProducts;
  const emptyStateTitle =
    activeCategory !== allCategoriesLabel
      ? `${activeCategory} is being refreshed`
      : activeFabric !== allFabricsLabel
        ? `${activeFabric} is coming back soon`
        : activeAvailability === "OUT OF STOCK"
          ? "These pieces are currently unavailable"
          : activeBrowse === browseFeaturedLabel
            ? "Featured pieces are being refreshed"
            : activeBrowse === browseNewArrivalsLabel
              ? "New arrivals are on the way"
              : "The collection is being updated";
  const emptyStateDescription =
    activeCategory !== allCategoriesLabel
      ? `More ${activeCategory.toLowerCase()} pieces will be added soon. Explore other curated sarees for now.`
      : activeFabric !== allFabricsLabel
        ? `We are curating more ${activeFabric.toLowerCase()} drapes at the moment. Browse other fabrics while they are added.`
        : activeAvailability === "OUT OF STOCK"
          ? "Everything in this selection is sold out for now, but fresh boutique picks will be added soon."
          : activeBrowse === browseFeaturedLabel
            ? "A new set of highlighted boutique drapes will appear here shortly."
            : activeBrowse === browseNewArrivalsLabel
              ? "Fresh sarees are being added now. Explore the wider collection in the meantime."
              : "This selection is temporarily light, and more boutique sarees will appear here soon.";

  const alternateCategoryCards = useMemo(() => {
    const currentCuratedFilter = activeCuratedFilter.trim().toLowerCase();
    const currentBrowseLabel = activeBrowse.trim().toLowerCase();
    const currentCategory = activeCategory.trim().toLowerCase();

    return activeCategoryCards
      .filter((card) => {
        const cardFilter = (card.shopFilter || card.title).trim().toLowerCase();
        const cardTitle = card.title.trim().toLowerCase();

        if (currentCuratedFilter) {
          return cardFilter !== currentCuratedFilter && cardTitle !== currentCuratedFilter;
        }

        if (activeCategory !== allCategoriesLabel) {
          return cardFilter !== currentCategory && cardTitle !== currentCategory;
        }

        return cardFilter !== currentBrowseLabel && cardTitle !== currentBrowseLabel;
      })
      .map((card) => ({
        title: card.title,
        imageUrl: card.imageUrl,
        shopHref: buildShopHref({ browse: "curated", filter: card.shopFilter || card.title }),
        backgroundPosition: card.backgroundPosition || "center"
      }));
  }, [activeBrowse, activeCategory, activeCategoryCards, activeCuratedFilter]);

  const shouldShowExploreCategories =
    alternateCategoryCards.length > 0 &&
    (activeCategory !== allCategoriesLabel ||
      (activeBrowse !== browseAllLabel &&
        activeBrowse !== browseNewArrivalsLabel &&
        activeBrowse !== browseFeaturedLabel));

  function handleBrowseSelect(value: string) {
    const option = browseOptions.find((item) => item.title === value);

    setActiveCategory(allCategoriesLabel);
    setActiveFabric(allFabricsLabel);
    setActiveAvailability(allAvailabilityLabel);

    if (!option || option.kind === "all") {
      setActiveBrowse(browseAllLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopPath(buildShopPath());
      return;
    }

    if (option.kind === "new-arrivals") {
      setActiveBrowse(browseNewArrivalsLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopPath(buildShopPath({ browse: "new-arrivals" }));
      return;
    }

    if (option.kind === "featured") {
      setActiveBrowse(browseFeaturedLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopPath(buildShopPath({ browse: "featured" }));
      return;
    }

    setActiveBrowse(option.title);
    setActiveCuratedFilter(option.shopFilter);
    replaceVisibleShopPath(buildShopPath({ browse: "curated", filter: option.shopFilter }));
  }

  function handleCategorySelect(value: string) {
    setActiveCategory(value);

    if (activeBrowse !== browseAllLabel || activeCuratedFilter) {
      setActiveBrowse(browseAllLabel);
      setActiveCuratedFilter("");
    }

    replaceVisibleShopPath(
      value === allCategoriesLabel ? buildShopPath() : buildShopPath({ browse: "curated", filter: value })
    );
  }

  function handleFabricSelect(value: string) {
    setActiveFabric(value);
  }

  function handleAvailabilitySelect(value: string) {
    setActiveAvailability(value);
  }

  function handleClearFilters() {
    setActiveBrowse(browseAllLabel);
    setActiveCuratedFilter("");
    setActiveCategory(allCategoriesLabel);
    setActiveFabric(allFabricsLabel);
    setActiveAvailability(allAvailabilityLabel);
    replaceVisibleShopPath(buildShopPath());
  }

  return (
    <main className="relative min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section
        id="shop-grid"
        className="relative overflow-hidden border-b border-[#e7dccc] bg-[#fbf4e8] px-6 py-8 sm:px-10 lg:px-12"
      >
        <div className="mx-auto max-w-7xl">
          <div className="relative rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] lg:p-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto] xl:items-end">
              <FilterSelect
                label="Browse"
                options={browseOptions.map((option) => option.title)}
                activeValue={activeBrowse}
                onSelect={handleBrowseSelect}
              />
              <FilterSelect
                label="Category"
                options={categories}
                activeValue={activeCategory}
                onSelect={handleCategorySelect}
              />
              <FilterSelect
                label="Fabric"
                options={fabrics}
                activeValue={activeFabric}
                onSelect={handleFabricSelect}
              />
              <FilterSelect
                label="Availability"
                options={[allAvailabilityLabel, "AVAILABLE", "OUT OF STOCK"]}
                activeValue={activeAvailability}
                onSelect={handleAvailabilitySelect}
              />

              <button
                type="button"
                onClick={handleClearFilters}
                className="brand-caption h-[52px] rounded-2xl border border-[#d6ccb9] px-5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
              >
                CLEAR FILTERS
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 pb-18 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                CATALOGUE
              </p>
              <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
                Sarees for every celebration and everyday elegance.
              </h2>
            </div>

            <p className="text-sm text-[#667056]">
              {filteredProducts.length} piece{filteredProducts.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <ProductLoadingGrid count={8} />
          ) : filteredProducts.length === 0 ? (
            <EmptyCatalogueState
              title={emptyStateTitle}
              description={emptyStateDescription}
              minHeightClass="min-h-[12rem] sm:min-h-[13rem]"
            />
          ) : (
            <>
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                {visibleFilteredProducts.map((product) => (
                  <CatalogueProductCard key={product.id ?? product.sku} product={product} />
                ))}
              </div>

              {hasMore ? (
                <div ref={loadMoreRef} className="mt-8 flex justify-center">
                  <span className="brand-caption rounded-full border border-[#d8cdbb] bg-[#fbf4e8] px-5 py-2 text-[0.56rem] font-semibold tracking-[0.08em] text-[#6d7561]">
                    Loading more sarees as you scroll
                  </span>
                </div>
              ) : null}
            </>
          )}

          {shouldShowExploreCategories ? (
            <section className="mt-14 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] px-5 py-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:px-6 sm:py-10 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-14 bg-[#d8cbb7] sm:w-20" />
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                    EXPLORE OTHER CATEGORIES
                  </p>
                  <div className="h-px w-14 bg-[#d8cbb7] sm:w-20" />
                </div>
              </div>

              <CategoryCarousel categories={alternateCategoryCards} />
            </section>
          ) : null}
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}

function replaceVisibleShopPath(nextPath: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(window.history.state, "", `${nextPath}${window.location.hash}`);
}

function FilterSelect({
  label,
  options,
  activeValue,
  onSelect
}: {
  label: string;
  options: string[];
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
        <select
          value={activeValue}
          onChange={(event) => onSelect(event.target.value)}
          className="h-[52px] w-full rounded-[1rem] border border-[#d6ccb9] bg-[#fbf7ef] px-4 text-sm text-[#4f5942] outline-none transition-colors duration-200 focus:border-[#5e684f]"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function matchesCuratedFilter(product: Saree, filterTerm: string) {
  const normalizedFilter = normalizeFilterTerm(filterTerm);

  return [
    product.category,
    product.fabric,
    product.color,
    product.name,
    product.collectionLabel,
    product.description
  ]
    .filter(Boolean)
    .some((value) => normalizeFilterTerm(String(value)).includes(normalizedFilter));
}

function normalizeFilterTerm(value: string) {
  return value.trim().toLowerCase();
}
