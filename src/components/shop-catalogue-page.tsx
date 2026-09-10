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
import { compareProductsByAvailability } from "@/lib/inventory";
import { matchesProductIntent, matchesProductSearch, SHOP_INTENT_TAGS } from "@/lib/product-discovery";
import { subscribeToSarees } from "@/lib/sarees";
import {
  buildShopHref,
  buildShopPath,
  buildShopVisiblePath,
  matchesRouteIdentifier,
  resolveShopLocation,
  resolveShopSearchQuery
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
const allIntentLabel = "ALL INTENTS";
const defaultSortLabel = "Newest";

type BrowseOption = {
  kind: "all" | "new-arrivals" | "featured" | "curated";
  title: string;
  shopFilter: string;
};

export function ShopCataloguePage() {
  const pathname = usePathname() ?? "/shop";
  const searchParams = useSearchParams();
  const currentSearchParams = searchParams ?? new URLSearchParams();
  const searchBrowse = currentSearchParams.get("browse");
  const searchFilter = currentSearchParams.get("filter");
  const searchQueryParam = resolveShopSearchQuery(pathname, currentSearchParams.get("q"));
  const [products, setProducts] = useState<Saree[]>([]);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [activeBrowse, setActiveBrowse] = useState(browseAllLabel);
  const [activeCuratedFilter, setActiveCuratedFilter] = useState("");
  const [activeIntent, setActiveIntent] = useState(allIntentLabel);
  const [activeCategory, setActiveCategory] = useState(allCategoriesLabel);
  const [activeFabric, setActiveFabric] = useState(allFabricsLabel);
  const [activeAvailability, setActiveAvailability] = useState(allAvailabilityLabel);
  const [searchQuery, setSearchQuery] = useState(searchQueryParam);
  const [activeSort, setActiveSort] = useState(defaultSortLabel);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setLoading(false);
      },
      { status: ["active", "out_of_stock"] }
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
    setSearchQuery(searchQueryParam);

    setActiveCategory(allCategoriesLabel);
    setActiveFabric(allFabricsLabel);
    setActiveAvailability(allAvailabilityLabel);
    setActiveIntent(allIntentLabel);

    if (routeState.browse === "new-arrivals") {
      setActiveBrowse(browseNewArrivalsLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopUrl(buildShopPath({ browse: "new-arrivals" }), searchQueryParam);
      return;
    }

    if (routeState.browse === "featured") {
      setActiveBrowse(browseFeaturedLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopUrl(buildShopPath({ browse: "featured" }), searchQueryParam);
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
        replaceVisibleShopUrl(buildShopPath({ browse: "curated", filter: matchingOption.shopFilter }), searchQueryParam);
        return;
      }

      const matchingIntent = SHOP_INTENT_TAGS.find((intent) => matchesRouteIdentifier(intent, routeState.filter)) ?? null;

      if (matchingIntent) {
        setActiveBrowse(browseAllLabel);
        setActiveCuratedFilter("");
        setActiveIntent(matchingIntent);
        replaceVisibleShopUrl(buildShopPath({ browse: "curated", filter: matchingIntent }), searchQueryParam);
        return;
      }

      const matchingCategory =
        categories.find((category) => matchesRouteIdentifier(category, routeState.filter)) ?? null;

      if (matchingCategory) {
        setActiveBrowse(browseAllLabel);
        setActiveCuratedFilter("");
        setActiveCategory(matchingCategory);
        replaceVisibleShopUrl(buildShopPath({ browse: "curated", filter: matchingCategory }), searchQueryParam);
        return;
      }

      const matchingFabric = fabrics.find((fabric) => matchesRouteIdentifier(fabric, routeState.filter)) ?? null;

      if (matchingFabric) {
        setActiveBrowse(browseAllLabel);
        setActiveCuratedFilter("");
        setActiveFabric(matchingFabric);
        replaceVisibleShopUrl(buildShopPath({ browse: "curated", filter: matchingFabric }), searchQueryParam);
        return;
      }
    }

    setActiveBrowse(browseAllLabel);
    setActiveCuratedFilter("");
    replaceVisibleShopUrl(buildShopPath(), searchQueryParam);
  }, [browseOptions, categories, fabrics, pathname, searchBrowse, searchFilter, searchQueryParam]);

  const browseFilteredProducts = products.filter((product) => {
    if (activeBrowse === browseNewArrivalsLabel) {
      return matchesProductIntent(product, "New");
    }

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
    const matchesIntent = activeIntent === allIntentLabel || matchesProductIntent(product, activeIntent);
    const matchesAvailability =
      activeAvailability === allAvailabilityLabel ||
      (activeAvailability === "AVAILABLE" && product.status === "active") ||
      (activeAvailability === "OUT OF STOCK" && product.status === "out_of_stock");
    const matchesSearch = matchesProductSearch(product, searchQuery);

    return matchesCategory && matchesFabric && matchesIntent && matchesAvailability && matchesSearch;
  });
  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, activeSort),
    [activeSort, filteredProducts]
  );
  const { hasMore, loadMoreRef, visibleItemsCount } = useProgressiveProductGrid(
    sortedProducts.length,
    [activeBrowse, activeCuratedFilter, activeIntent, activeCategory, activeFabric, activeAvailability, searchQuery, activeSort].join("|")
  );
  const visibleFilteredProducts = useMemo(
    () => sortedProducts.slice(0, visibleItemsCount),
    [sortedProducts, visibleItemsCount]
  );
  const hasFilteredProducts = sortedProducts.length > 0;
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
              : activeIntent !== allIntentLabel
                ? `${activeIntent} picks are being refreshed`
              : "The collection is being updated";
  const emptyStateDescription =
    activeCategory !== allCategoriesLabel
      ? `More ${activeCategory.toLowerCase()} pieces will be added soon. Explore other curated sarees for now.`
      : activeFabric !== allFabricsLabel
        ? `We are curating more ${activeFabric.toLowerCase()} drapes at the moment. Browse other fabrics while they are added.`
        : activeIntent !== allIntentLabel
          ? `More ${activeIntent.toLowerCase()} sarees will be added soon. Try nearby intents or browse the full collection.`
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
    setActiveIntent(allIntentLabel);

    if (!option || option.kind === "all") {
      setActiveBrowse(browseAllLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopUrl(buildShopPath(), searchQuery);
      return;
    }

    if (option.kind === "new-arrivals") {
      setActiveBrowse(browseNewArrivalsLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopUrl(buildShopPath({ browse: "new-arrivals" }), searchQuery);
      return;
    }

    if (option.kind === "featured") {
      setActiveBrowse(browseFeaturedLabel);
      setActiveCuratedFilter("");
      replaceVisibleShopUrl(buildShopPath({ browse: "featured" }), searchQuery);
      return;
    }

    setActiveBrowse(option.title);
    setActiveCuratedFilter(option.shopFilter);
    replaceVisibleShopUrl(buildShopPath({ browse: "curated", filter: option.shopFilter }), searchQuery);
  }

  function handleIntentSelect(value: string) {
    setActiveBrowse(browseAllLabel);
    setActiveCuratedFilter("");
    setActiveIntent(value);
    replaceVisibleShopUrl(
      value === allIntentLabel ? buildShopPath() : buildShopPath({ browse: "curated", filter: value }),
      searchQuery
    );
  }

  function handleCategorySelect(value: string) {
    setActiveCategory(value);

    if (activeBrowse !== browseAllLabel || activeCuratedFilter) {
      setActiveBrowse(browseAllLabel);
      setActiveCuratedFilter("");
    }

    replaceVisibleShopUrl(
      value === allCategoriesLabel ? buildShopPath() : buildShopPath({ browse: "curated", filter: value }),
      searchQuery
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
    setActiveIntent(allIntentLabel);
    setActiveCategory(allCategoriesLabel);
    setActiveFabric(allFabricsLabel);
    setActiveAvailability(allAvailabilityLabel);
    setSearchQuery("");
    setActiveSort(defaultSortLabel);
    replaceVisibleShopUrl(buildShopPath(), "");
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    replaceVisibleShopUrl(
      activeBrowse === browseNewArrivalsLabel
        ? buildShopPath({ browse: "new-arrivals" })
        : activeBrowse === browseFeaturedLabel
          ? buildShopPath({ browse: "featured" })
          : activeCuratedFilter
            ? buildShopPath({ browse: "curated", filter: activeCuratedFilter })
            : activeIntent !== allIntentLabel
              ? buildShopPath({ browse: "curated", filter: activeIntent })
              : activeCategory !== allCategoriesLabel
                ? buildShopPath({ browse: "curated", filter: activeCategory })
                : buildShopPath(),
      searchQuery
    );
  }

  const activeFilters = buildActiveFilters({
    activeAvailability,
    activeBrowse,
    activeCategory,
    activeFabric,
    activeIntent,
    activeSort,
    searchQuery
  });
  const appliedFilterCount = activeFilters.length;

  function clearSingleFilter(filterKey: string) {
    if (filterKey === "browse") {
      handleBrowseSelect(browseAllLabel);
      return;
    }

    if (filterKey === "intent") {
      handleIntentSelect(allIntentLabel);
      return;
    }

    if (filterKey === "category") {
      handleCategorySelect(allCategoriesLabel);
      return;
    }

    if (filterKey === "fabric") {
      handleFabricSelect(allFabricsLabel);
      return;
    }

    if (filterKey === "availability") {
      handleAvailabilitySelect(allAvailabilityLabel);
      return;
    }

    if (filterKey === "sort") {
      setActiveSort(defaultSortLabel);
      return;
    }

    setSearchQuery("");
    replaceVisibleShopUrl(window.location.pathname, "");
  }

  return (
    <main className="web-storefront relative min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section
        id="shop-grid"
        className="web-shop-tools relative border-b border-[#e7dccc] bg-[#fbf4e8] px-6 py-6 sm:px-10 lg:px-12"
      >
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            <div className="space-y-5">
              <div className="web-shop-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                    CURATED CATALOGUE
                  </p>
                  <h1 className="brand-copy mt-2 text-3xl leading-tight text-[#2b2a29]">
                    The saree collection
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667056]">
                    Find your next drape by fabric, occasion, or colour.
                  </p>
                </div>

                <div className="shrink-0 text-sm text-[#667056] sm:text-right">
                  <p className="sr-only">
                    RESULTS
                  </p>
                  <p className="text-base font-semibold text-[#2b2a29]">
                    {sortedProducts.length} piece{sortedProducts.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-[#7d876f]">
                    {appliedFilterCount > 0
                      ? `${appliedFilterCount} filter${appliedFilterCount === 1 ? "" : "s"} active`
                      : "Showing the full collection"}
                  </p>
                </div>
              </div>

              <form
                className="web-filter-toolbar grid gap-3 rounded-2xl border border-[#e4d8c9] bg-[#fffdf8] p-4"
                onSubmit={handleSearchSubmit}
              >
                <FilterInput
                  label="Search"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search saree, fabric, color, wedding..."
                />
                <FilterSelect
                  label="Sort"
                  options={[defaultSortLabel, "Price: Low to High", "Price: High to Low", "Most Relevant"]}
                  activeValue={activeSort}
                  onSelect={setActiveSort}
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
                <div className="flex items-end gap-3">
                  <button
                    type="submit"
                    className="brand-caption h-[52px] rounded-2xl bg-[#5e684f] px-5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                  >
                    APPLY
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="brand-caption h-[52px] rounded-2xl border border-[#d6ccb9] px-5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                  >
                    CLEAR
                  </button>
                </div>
              </form>

              <div className="web-advanced-toolbar flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="brand-caption text-[0.68rem] font-semibold tracking-[0.1em] text-[#667056]">
                    ADVANCED FILTERS
                  </p>
                  <p className="text-sm text-[#667056]">
                    Browse mode and shopping intent.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvancedFiltersOpen((current) => !current)}
                  className="brand-caption inline-flex items-center gap-2 rounded-full border border-[#d6ccb9] bg-[#fffaf2] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                >
                  {advancedFiltersOpen ? "HIDE ADVANCED" : "SHOW ADVANCED"}
                  {(activeBrowse !== browseAllLabel || activeIntent !== allIntentLabel) ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#5e684f] px-1.5 py-0.5 text-[0.58rem] text-[#fbf4e8]">
                      {(activeBrowse !== browseAllLabel ? 1 : 0) + (activeIntent !== allIntentLabel ? 1 : 0)}
                    </span>
                  ) : null}
                </button>
              </div>

              {advancedFiltersOpen ? (
                <div className="space-y-5 rounded-[1.6rem] border border-[#e4d8c9] bg-[#fffaf2] p-5">
                  <div>
                    <p className="text-sm font-medium text-[#4f5942]">Browse</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {browseOptions.map((option) => (
                        <FilterChip
                          key={option.title}
                          label={option.title}
                          active={activeBrowse === option.title}
                          onClick={() => handleBrowseSelect(option.title)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#4f5942]">Shop by intent</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <FilterChip
                        label={allIntentLabel}
                        active={activeIntent === allIntentLabel}
                        onClick={() => handleIntentSelect(allIntentLabel)}
                      />
                      {SHOP_INTENT_TAGS.map((tag) => (
                        <FilterChip
                          key={tag}
                          label={tag}
                          active={activeIntent === tag}
                          onClick={() => handleIntentSelect(tag)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeFilters.length > 0 ? (
                <div className="rounded-[1.4rem] border border-[#eadfce] bg-[#fffaf2] px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#4f5942]">Active filters</p>
                    <p className="text-xs text-[#7d876f]">
                      {appliedFilterCount} selected
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => clearSingleFilter(filter.key)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#d9ccb8] bg-[#fffaf2] px-3 py-2 text-sm text-[#4f5942]"
                    >
                      <span>{filter.label}</span>
                      <span aria-hidden="true" className="text-[#7d876f]">
                        ×
                      </span>
                    </button>
                  ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="web-shop-results px-6 py-6 pb-14 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="sr-only">
                CATALOGUE
              </p>
              <h2 className="brand-copy text-2xl text-[#3f4738]">
                Discover your favourites
              </h2>
            </div>

            <p className="text-sm text-[#667056]">
              {sortedProducts.length} piece{sortedProducts.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <ProductLoadingGrid count={8} />
          ) : sortedProducts.length === 0 ? (
            <EmptyCatalogueState
              title={emptyStateTitle}
              description={emptyStateDescription}
              minHeightClass="min-h-[12rem] sm:min-h-[13rem]"
            />
          ) : (
            <>
              <div className="web-product-grid grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                {visibleFilteredProducts.map((product) => (
                  <CatalogueProductCard
                    key={product.id ?? product.sku}
                    product={product}
                    buttonLabel="ADD TO BAG"
                  />
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

function replaceVisibleShopUrl(nextPath: string, searchQuery: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = `${buildShopVisiblePath({ q: searchQuery, browse: resolveBrowseModeFromPath(nextPath), filter: resolveFilterFromPath(nextPath) })}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentUrl === nextUrl) {
    return;
  }

  window.history.replaceState(window.history.state, "", nextUrl);
}

function resolveBrowseModeFromPath(pathname: string) {
  if (pathname.includes("/shop/new-arrivals/")) {
    return "new-arrivals" as const;
  }

  if (pathname.includes("/shop/featured/")) {
    return "featured" as const;
  }

  if (pathname.includes("/shop/category/")) {
    return "curated" as const;
  }

  return "all" as const;
}

function resolveFilterFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "shop" && segments[1] === "category" && segments[2]) {
    return decodeURIComponent(segments[2]);
  }

  return "";
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

function FilterInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[52px] w-full rounded-[1rem] border border-[#d6ccb9] bg-[#fbf7ef] px-4 text-sm text-[#4f5942] outline-none transition-colors duration-200 placeholder:text-[#8d867b] focus:border-[#5e684f]"
      />
    </label>
  );
}

function FilterChip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
        active
          ? "border-[#5e684f] bg-[#5e684f] text-[#fbf4e8]"
          : "border-[#d6ccb9] bg-[#fbf7ef] text-[#4f5942] hover:bg-[#fffaf2]"
      }`}
    >
      {label}
    </button>
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

function sortProducts(products: Saree[], activeSort: string) {
  const sorted = [...products];

  if (activeSort === "Price: Low to High") {
    return sorted.sort((left, right) => compareProductsByAvailability(left, right) || left.price - right.price);
  }

  if (activeSort === "Price: High to Low") {
    return sorted.sort((left, right) => compareProductsByAvailability(left, right) || right.price - left.price);
  }

  if (activeSort === "Most Relevant") {
    return sorted.sort((left, right) => {
      const availabilityDifference = compareProductsByAvailability(left, right);
      if (availabilityDifference !== 0) {
        return availabilityDifference;
      }

      const leftScore = Number(left.featured) * 10 + Number(left.status === "active") * 5;
      const rightScore = Number(right.featured) * 10 + Number(right.status === "active") * 5;

      return rightScore - leftScore;
    });
  }

  return sorted.sort((left, right) => compareProductsByAvailability(left, right));
}

function buildActiveFilters({
  activeAvailability,
  activeBrowse,
  activeCategory,
  activeFabric,
  activeIntent,
  activeSort,
  searchQuery
}: {
  activeAvailability: string;
  activeBrowse: string;
  activeCategory: string;
  activeFabric: string;
  activeIntent: string;
  activeSort: string;
  searchQuery: string;
}) {
  const filters = [];

  if (activeBrowse !== browseAllLabel) {
    filters.push({ key: "browse", label: activeBrowse });
  }

  if (activeIntent !== allIntentLabel) {
    filters.push({ key: "intent", label: activeIntent });
  }

  if (activeCategory !== allCategoriesLabel) {
    filters.push({ key: "category", label: activeCategory });
  }

  if (activeFabric !== allFabricsLabel) {
    filters.push({ key: "fabric", label: activeFabric });
  }

  if (activeAvailability !== allAvailabilityLabel) {
    filters.push({ key: "availability", label: activeAvailability });
  }

  if (searchQuery.trim()) {
    filters.push({ key: "search", label: `Search: ${searchQuery.trim()}` });
  }

  if (activeSort !== defaultSortLabel) {
    filters.push({ key: "sort", label: activeSort });
  }

  return filters;
}
