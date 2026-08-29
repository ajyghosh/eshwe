"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryCarousel } from "@/components/category-carousel";
import { subscribeToCategoryCards, subscribeToHomePageContent } from "@/lib/homepage";
import { SHOP_INTENT_TAGS } from "@/lib/product-discovery";
import { buildShopHref } from "@/lib/storefront-routes";
import {
  DEFAULT_HOME_PAGE_CONTENT,
  normalizeHomeLaunchCardMaxWidth,
  type CategoryCard,
  type HomePageContent
} from "@/types/homepage";

export function StorefrontHomeContent({ homeReady }: { homeReady: boolean }) {
  const [homePageContent, setHomePageContent] = useState<HomePageContent>(DEFAULT_HOME_PAGE_CONTENT);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const heroImageUrl = homePageContent.heroImageUrl.trim();
  const launchImageUrl = homePageContent.launchImageUrl.trim();
  const launchHasImage = Boolean(launchImageUrl);
  const launchCardMaxWidth = normalizeHomeLaunchCardMaxWidth(homePageContent.launchCardMaxWidth);
  const launchImageLayout = homePageContent.launchImageLayout;

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setHomePageContent(content ? { ...DEFAULT_HOME_PAGE_CONTENT, ...content } : DEFAULT_HOME_PAGE_CONTENT);
    });
  }, []);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards);
    });
  }, []);

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [heroImageUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!heroImageLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new Event("eshwe:home-hero-ready"));
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [heroImageLoaded]);

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
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform,filter] duration-[1200ms] ease-out ${
              heroImageLoaded ? "scale-100 opacity-100 blur-0" : "scale-[1.035] opacity-0 blur-[10px]"
            }`}
            style={{ objectPosition: homePageContent.heroImagePosition || "center" }}
            fetchPriority="high"
            loading="eager"
            onLoad={() => setHeroImageLoaded(true)}
          />
        ) : null}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-[900ms] ${
            heroImageLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[rgba(251,244,232,0.22)]" />
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="relative flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
              <div className="hero-loader-ring absolute inset-0 rounded-full border-[2.5px] border-[#d9c6a4] border-t-[#5e684f]" />
              <div className="relative flex h-[5.4rem] w-[5.4rem] items-center justify-center rounded-full bg-[rgba(255,250,241,0.86)] shadow-[0_24px_60px_rgba(94,104,79,0.12)] backdrop-blur-md sm:h-[6.8rem] sm:w-[6.8rem]">
                <Image
                  src="/eshwelogo-transparent.png"
                  alt="Eshwe"
                  width={96}
                  height={96}
                  className="h-14 w-14 object-contain sm:h-[4.2rem] sm:w-[4.2rem]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,241,0.05),rgba(251,244,232,0.14))]" />
        <div
          className={`relative z-10 flex min-h-screen items-end px-6 pb-14 transition-[opacity,transform] duration-700 ease-out sm:px-10 sm:pb-18 lg:px-12 lg:pb-20 ${
            homeReady
              ? "launch-fade-up launch-fade-up-late translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
        >
          <div
            className="w-full rounded-[1.6rem] border border-[#f3dfaa]/40 bg-[rgba(67,79,57,0.56)] px-5 py-4 text-[#fbf4e8] shadow-[0_18px_40px_rgba(43,42,41,0.16)] backdrop-blur-[3px] sm:px-6 sm:py-5"
            style={{ maxWidth: `${launchCardMaxWidth}px` }}
          >
            <div
              className={`flex gap-4 ${
                launchHasImage && launchImageLayout !== "top"
                  ? "flex-col sm:flex-row sm:items-stretch"
                  : "flex-col"
              }`}
            >
              {launchHasImage ? (
                <div
                  className={`overflow-hidden rounded-[1.2rem] border border-white/12 bg-[rgba(255,248,238,0.14)] ${
                    launchImageLayout === "top"
                      ? "aspect-[1.75] w-full"
                      : "aspect-[1.02] w-full sm:w-[38%] sm:min-w-[168px]"
                  } ${launchImageLayout === "left" ? "sm:order-1" : ""} ${
                    launchImageLayout === "right" ? "sm:order-2" : ""
                  }`}
                  style={{
                    backgroundImage: `url('${launchImageUrl}')`,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "cover"
                  }}
                  aria-label={homePageContent.launchImageAlt || "Homepage announcement image"}
                  role="img"
                />
              ) : null}

              <div
                className={`min-w-0 ${
                  launchHasImage && launchImageLayout === "right" ? "sm:order-1" : ""
                } ${launchHasImage && launchImageLayout === "left" ? "sm:order-2" : ""}`}
              >
                {homePageContent.launchEyebrow ? (
                  <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.22em] text-[#f3dfaa]">
                    {homePageContent.launchEyebrow}
                  </p>
                ) : null}

                {homePageContent.launchHeading ? (
                  <h2 className="brand-copy mt-3 text-2xl leading-[1.15] text-[#fbf4e8] sm:text-[2rem]">
                    {homePageContent.launchHeading}
                  </h2>
                ) : null}

                {homePageContent.launchBody ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#f8f1e3]/88">
                    {homePageContent.launchBody}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/shop/"
                    className="brand-caption inline-flex rounded-full bg-[#fbf4e8] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.12em] !text-[#485343] transition-colors duration-200 hover:bg-white"
                  >
                    SHOP SAREES
                  </Link>
                  <Link
                    href="#categories"
                    className="brand-caption inline-flex rounded-full border border-[#fbf4e8]/24 px-5 py-3 text-[0.62rem] font-semibold tracking-[0.12em] text-[#fbf4e8] transition-colors duration-200 hover:bg-[#fbf4e8]/10"
                  >
                    EXPLORE COLLECTIONS
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {SHOP_INTENT_TAGS.slice(0, 5).map((tag) => (
                    <Link
                      key={tag}
                      href={`/shop/?browse=curated&filter=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-[#fbf4e8]/18 bg-[#fbf4e8]/8 px-3 py-1.5 text-xs text-[#f8f1e3] transition-colors duration-200 hover:bg-[#fbf4e8]/14"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {activeCategoryCards.length > 0 ? (
        <section
          id="categories"
          className={`relative z-10 bg-[#fbf4e8] px-6 py-20 transition-[opacity,transform] duration-700 ease-out sm:px-10 lg:px-12 ${
            homeReady ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
          }`}
        >
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
