"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Category = {
  title: string;
  imageUrl?: string;
  backgroundPosition: string;
  fallbackBackground?: string;
  shopHref?: string;
};

type CategoryCarouselProps = {
  categories: Category[];
};

export function CategoryCarousel({ categories }: CategoryCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateActiveIndex = () => {
      const cards = container.querySelectorAll<HTMLElement>("[data-category-card='true']");

      if (cards.length === 0) {
        return;
      }

      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      const targetLeft = container.scrollLeft;

      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - targetLeft);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveIndex(closestIndex);
    };

    updateActiveIndex();
    container.addEventListener("scroll", updateActiveIndex, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateActiveIndex);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextIndex = activeIndex === categories.length - 1 ? 0 : activeIndex + 1;

      scrollToCard(nextIndex);
    }, 3200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeIndex, categories.length]);

  const scrollToCard = (index: number) => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const cards = container.querySelectorAll<HTMLElement>("[data-category-card='true']");
    const targetCard = cards[index];

    if (!targetCard) {
      return;
    }

    container.scrollTo({
      left: targetCard.offsetLeft,
      behavior: "smooth"
    });
  };

  const scrollByStep = (direction: -1 | 1) => {
    const nextIndex =
      direction === 1
        ? activeIndex === categories.length - 1
          ? 0
          : activeIndex + 1
        : activeIndex === 0
          ? categories.length - 1
          : activeIndex - 1;

    scrollToCard(nextIndex);
  };

  return (
    <div className="mt-18">
      <div className="relative mx-auto max-w-6xl">
        <button
          type="button"
          aria-label="Previous category"
          onClick={() => scrollByStep(-1)}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-6xl leading-none text-white/95 transition-opacity duration-300 hover:opacity-70 sm:left-5 sm:text-7xl"
        >
          ‹
        </button>

        <div
          ref={containerRef}
          className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:gap-6 lg:gap-8"
        >
          {categories.map((category) => (
            <Link
              key={category.title}
              href={category.shopHref ?? "/shop"}
              data-category-card="true"
              className="relative block h-[240px] w-[220px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] sm:h-[270px] sm:w-[250px] lg:h-[300px] lg:w-[calc((100%-6rem)/4)]"
              style={{
                backgroundImage: category.imageUrl
                  ? `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.28)), url('${category.imageUrl}')`
                  : category.fallbackBackground ?? "linear-gradient(180deg, #ede7dc 0%, #b8b0a6 100%)",
                backgroundPosition: category.backgroundPosition,
                backgroundSize: "cover"
              }}
            >
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-7">
                <h3 className="brand-copy text-sm text-white sm:text-base lg:text-[1.2rem]">
                  {category.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next category"
          onClick={() => scrollByStep(1)}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-6xl leading-none text-white/95 transition-opacity duration-300 hover:opacity-70 sm:right-5 sm:text-7xl"
        >
          ›
        </button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        {categories.map((category, index) => (
          <button
            key={category.title}
            type="button"
            aria-label={`Go to ${category.title}`}
            onClick={() => scrollToCard(index)}
            className={`h-3 w-3 rounded-full transition-colors duration-300 ${
              index === activeIndex ? "bg-black" : "bg-black/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
