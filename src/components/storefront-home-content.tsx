"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CategoryCarousel } from "@/components/category-carousel";
import { fallbackCategoryCards, fallbackCategoryGradients } from "@/lib/category-presets";
import { subscribeToCategoryCards, subscribeToHomePageContent } from "@/lib/homepage";
import { buildShopHref } from "@/lib/storefront-routes";
import type { CategoryCard, HomePageContent } from "@/types/homepage";

const defaultHomePageContent: HomePageContent = {
  heroImageUrl: "/home.PNG",
  heroImagePath: "",
  heroImagePosition: "center 7%",
  categoriesHeading: "Categories You Might Like",
  categoriesSubtitle: "View all categories"
};

export function StorefrontHomeContent() {
  const [homePageContent, setHomePageContent] = useState<HomePageContent>(defaultHomePageContent);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToHomePageContent(
      (content) => {
        setHomePageContent(content ? { ...defaultHomePageContent, ...content } : defaultHomePageContent);
      },
      (error) => {
        setReadError(error.message);
      }
    );
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards(
      (cards) => {
        setCategoryCards(cards);
      },
      (error) => {
        setReadError(error.message);
      }
    );
  }, []);

  const activeCategoryCards = useMemo(() => {
    const cards = categoryCards.filter((card) => card.active);
    return cards.length > 0 ? cards : fallbackCategoryCards;
  }, [categoryCards]);

  const carouselCategories = activeCategoryCards.map((card, index) => ({
    title: card.title,
    imageUrl: card.imageUrl,
    shopHref: buildShopHref({ browse: "curated", filter: card.shopFilter || card.title }),
    backgroundPosition: card.backgroundPosition || "center",
    fallbackBackground: fallbackCategoryGradients[index % fallbackCategoryGradients.length]
  }));

  return (
    <>
      <section
        id="home"
        className="relative min-h-screen w-full overflow-hidden"
        style={{
          backgroundImage: `url('${homePageContent.heroImageUrl || defaultHomePageContent.heroImageUrl}')`,
          backgroundPosition: homePageContent.heroImagePosition || defaultHomePageContent.heroImagePosition,
          backgroundSize: "cover"
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,241,0.05),rgba(251,244,232,0.14))]" />
        <div className="launch-fade-up launch-fade-up-late relative z-10 min-h-screen" />
      </section>

      <section id="categories" className="relative z-10 bg-[#fbf4e8] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="brand-copy text-2xl leading-tight text-[#2b2a29] sm:text-3xl">
              {homePageContent.categoriesHeading}
            </h2>
            <Link
              href="/shop"
              className="mt-4 inline-flex text-xs text-[#4f5942] underline decoration-1 underline-offset-4 transition-colors duration-300 hover:text-[#2b2a29] sm:text-sm"
            >
              {homePageContent.categoriesSubtitle}
            </Link>
          </div>

          {readError ? (
            <p className="mt-6 text-center text-sm text-[#9d4b45]">
              Firebase read failed: {readError}
            </p>
          ) : null}

          <CategoryCarousel categories={carouselCategories} />
        </div>
      </section>
    </>
  );
}
