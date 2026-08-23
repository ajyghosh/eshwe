"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  CatalogueProductCard,
  EmptyCatalogueState,
  ProductLoadingGrid
} from "@/components/catalogue-product-card";
import { ProductCardCarousel } from "@/components/product-card-carousel";
import { subscribeToSarees } from "@/lib/sarees";
import { buildShopHref } from "@/lib/storefront-routes";
import { useProgressiveProductGrid } from "@/lib/use-progressive-product-grid";
import type { Saree } from "@/types/saree";

export function StorefrontCatalogue() {
  const [products, setProducts] = useState<Saree[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL PRODUCTS");
  const [activeShowcase, setActiveShowcase] = useState<"new_arrivals" | "featured">("new_arrivals");

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setLoading(false);
      },
      {}
    );
  }, []);

  const featuredProducts = products.filter((product) => product.featured);
  const newArrivalRow = products;
  const showcaseProducts = activeShowcase === "featured" ? featuredProducts : newArrivalRow;
  const showcaseUsesCarousel = showcaseProducts.length > 4;

  const categories = useMemo(
    () => ["ALL PRODUCTS", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))],
    [products]
  );

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory("ALL PRODUCTS");
    }
  }, [activeCategory, categories]);

  const visibleProducts =
    activeCategory === "ALL PRODUCTS"
      ? products
      : products.filter((product) => product.category === activeCategory);
  const { hasMore, loadMoreRef, visibleItemsCount: visibleProductsCount } = useProgressiveProductGrid(
    visibleProducts.length,
    activeCategory,
    {
      initialBatchSize: 12,
      loadMoreBatchSize: 8
    }
  );
  const visibleCollectionProducts = useMemo(
    () => visibleProducts.slice(0, visibleProductsCount),
    [visibleProducts, visibleProductsCount]
  );

  return (
    <>
      <section id="featured" className="relative z-10 bg-[#f5ecdd] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveShowcase("new_arrivals")}
              className={`brand-caption rounded-2xl px-8 py-4 text-[0.72rem] font-semibold tracking-[0.12em] sm:px-10 sm:text-[0.82rem] ${
                activeShowcase === "new_arrivals"
                  ? "bg-[#5e684f] text-[#fbf4e8]"
                  : "border border-[#d8cfbf] bg-[#f8f0e3] text-[#5e684f]"
              }`}
            >
              NEW ARRIVALS
            </button>
            <button
              type="button"
              onClick={() => setActiveShowcase("featured")}
              className={`brand-caption rounded-2xl px-8 py-4 text-[0.72rem] font-semibold tracking-[0.12em] sm:px-10 sm:text-[0.82rem] ${
                activeShowcase === "featured"
                  ? "bg-[#5e684f] text-[#fbf4e8]"
                  : "border border-[#d8cfbf] bg-[#f8f0e3] text-[#5e684f]"
              }`}
            >
              FEATURED PRODUCTS
            </button>
          </div>

          <div className="mt-10 rounded-[1.75rem] p-7 sm:p-10">
            {loading ? (
              <ProductLoadingGrid />
            ) : showcaseProducts.length === 0 ? (
              <EmptyCatalogueState minHeightClass="min-h-[11rem] sm:min-h-[12rem]" />
            ) : (
              <>
                {showcaseUsesCarousel ? (
                  <ProductCardCarousel products={showcaseProducts} />
                ) : (
                  <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
                    {showcaseProducts.map((product) => (
                      <CatalogueProductCard key={product.id ?? product.sku} product={product} />
                    ))}
                  </div>
                )}

                <div className="mt-12 flex justify-center">
                  <Link
                    href={
                      activeShowcase === "featured"
                        ? buildShopHref({ browse: "featured" })
                        : buildShopHref({ browse: "new-arrivals" })
                    }
                    className="brand-caption rounded-[1.4rem] bg-[#6b7a5e] px-12 py-4 text-[0.72rem] font-semibold tracking-[0.1em] !text-[#fbf4e8] hover:!text-[#fbf4e8] visited:!text-[#fbf4e8] sm:text-[0.78rem]"
                  >
                    View All
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section
        id="collections"
        className="relative z-10 overflow-hidden bg-[#fbf4e8] px-6 py-16 sm:px-10 sm:py-18 lg:px-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(120,130,92,0.08),transparent_26%)]" />
        <div className="mx-auto max-w-7xl">
          <div className="relative flex flex-wrap justify-center gap-3 sm:gap-4">
            {categories.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCategory(tab)}
                className={
                  activeCategory === tab
                    ? "brand-caption rounded-[1.1rem] bg-[#5e684f] px-6 py-4 text-[0.7rem] font-semibold tracking-[0.06em] text-[#fbf4e8] sm:px-8 sm:text-[0.78rem]"
                    : index === 0
                      ? "brand-caption rounded-[1.1rem] border border-[#d8d0c2] bg-[#f7f3ec] px-6 py-4 text-[0.7rem] font-semibold tracking-[0.06em] text-[#3f4738] sm:px-8 sm:text-[0.78rem]"
                      : "brand-caption rounded-[1.1rem] border border-[#d8d0c2] bg-[#f7f3ec] px-6 py-4 text-[0.7rem] font-semibold tracking-[0.06em] text-[#3f4738] sm:px-8 sm:text-[0.78rem]"
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative mt-8 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-5 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-6 lg:p-7">
            {loading ? (
              <ProductLoadingGrid />
            ) : visibleProducts.length === 0 ? (
              <EmptyCatalogueState minHeightClass="min-h-[11rem] sm:min-h-[12rem]" />
            ) : (
              <>
                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                  {visibleCollectionProducts.map((product) => (
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
          </div>
        </div>
      </section>
    </>
  );
}
