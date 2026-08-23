"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryCarousel } from "@/components/category-carousel";
import { subscribeToCategoryCards, subscribeToHomePageContent } from "@/lib/homepage";
import { buildShopHref } from "@/lib/storefront-routes";
import type { CategoryCard, HomePageContent } from "@/types/homepage";

const emptyHomePageContent: HomePageContent = {
  heroImageUrl: "",
  heroImagePath: "",
  heroImagePosition: "center",
  categoriesHeading: "",
  categoriesSubtitle: ""
};

export function StorefrontHomeContent() {
  const [homePageContent, setHomePageContent] = useState<HomePageContent>(emptyHomePageContent);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const heroImageUrl = homePageContent.heroImageUrl.trim();

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setHomePageContent(content ?? emptyHomePageContent);
    });
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards);
    });
  }, []);

  const activeCategoryCards = categoryCards.filter((card) => card.active);
  const carouselCategories = activeCategoryCards.map((card) => ({
    title: card.title,
    imageUrl: card.imageUrl,
    shopHref: buildShopHref({ browse: "curated", filter: card.shopFilter || card.title }),
    backgroundPosition: card.backgroundPosition || "center"
  }));

  return (
    <>
      <section
        id="home"
        className="relative min-h-screen w-full overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #efe5d7 0%, #d6c7b2 100%)"
        }}
      >
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="eshwe boutique hero"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: homePageContent.heroImagePosition || "center" }}
            fetchPriority="high"
            loading="eager"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,241,0.05),rgba(251,244,232,0.14))]" />
        <div className="launch-fade-up launch-fade-up-late relative z-10 flex min-h-screen items-end px-6 pb-14 sm:px-10 sm:pb-18 lg:px-12 lg:pb-20">
          <div className="max-w-md rounded-[1.6rem] border border-[#f3dfaa]/40 bg-[rgba(67,79,57,0.56)] px-5 py-4 text-[#fbf4e8] shadow-[0_18px_40px_rgba(43,42,41,0.16)] backdrop-blur-[3px] sm:px-6 sm:py-5">
            <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.22em] text-[#f3dfaa]">
              OPENING SHORTLY
            </p>
            <h2 className="brand-copy mt-3 text-2xl leading-[1.15] text-[#fbf4e8] sm:text-[2rem]">
              We are currently in a soft launch preview.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#f8f1e3]/88">
              The boutique is live for a trial run while we fine-tune the experience and curate the
              first collections.
            </p>
          </div>
        </div>
      </section>

      {activeCategoryCards.length > 0 ? (
        <section id="categories" className="relative z-10 bg-[#fbf4e8] px-6 py-20 sm:px-10 lg:px-12">
          <div className="mx-auto max-w-7xl">
            {homePageContent.categoriesHeading || homePageContent.categoriesSubtitle ? (
              <div className="text-center">
                {homePageContent.categoriesHeading ? (
                  <h2 className="brand-copy text-2xl leading-tight text-[#2b2a29] sm:text-3xl">
                    {homePageContent.categoriesHeading}
                  </h2>
                ) : null}
                {homePageContent.categoriesSubtitle ? (
                  <Link
                    href="/shop"
                    className="mt-4 inline-flex text-xs text-[#4f5942] underline decoration-1 underline-offset-4 transition-colors duration-300 hover:text-[#2b2a29] sm:text-sm"
                  >
                    {homePageContent.categoriesSubtitle}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <CategoryCarousel categories={carouselCategories} />
          </div>
        </section>
      ) : null}
    </>
  );
}
