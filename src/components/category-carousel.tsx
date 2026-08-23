"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Category = {
  title: string;
  imageUrl?: string;
  backgroundPosition: string;
  shopHref?: string;
};

type CategoryCarouselProps = {
  categories: Category[];
};

export function CategoryCarousel({ categories }: CategoryCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollResetTimeoutRef = useRef<number | null>(null);
  const isResettingRef = useRef(false);
  const categoryCount = categories.length;
  const loopedCategories =
    categoryCount > 1 ? [...categories, ...categories, ...categories] : categories;
  const [currentIndex, setCurrentIndex] = useState(categoryCount > 1 ? categoryCount : 0);

  const normalizeIndex = useCallback(
    (index: number) => {
      if (categoryCount === 0) {
        return 0;
      }

      return ((index % categoryCount) + categoryCount) % categoryCount;
    },
    [categoryCount]
  );

  const scrollToRenderedIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const cards = container.querySelectorAll<HTMLElement>("[data-category-card='true']");

      if (cards.length === 0) {
        return;
      }

      const targetIndex =
        categoryCount > 1 && (index < 0 || index >= cards.length)
          ? categoryCount + normalizeIndex(index)
          : index;
      const targetCard = cards[targetIndex];

      if (!targetCard) {
        return;
      }

      setCurrentIndex(targetIndex);
      container.scrollTo({
        left: targetCard.offsetLeft,
        behavior
      });
    },
    [categoryCount, normalizeIndex]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || categoryCount === 0) {
      return;
    }

    const syncCurrentIndex = () => {
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

      setCurrentIndex(closestIndex);

      if (categoryCount > 1) {
        if (scrollResetTimeoutRef.current !== null) {
          window.clearTimeout(scrollResetTimeoutRef.current);
        }

        scrollResetTimeoutRef.current = window.setTimeout(() => {
          if (isResettingRef.current) {
            return;
          }

          const needsReset = closestIndex < categoryCount || closestIndex >= categoryCount * 2;

          if (!needsReset) {
            return;
          }

          const resetIndex = categoryCount + normalizeIndex(closestIndex);
          const resetCard = cards[resetIndex];

          if (!resetCard) {
            return;
          }

          isResettingRef.current = true;
          setCurrentIndex(resetIndex);
          container.scrollTo({
            left: resetCard.offsetLeft,
            behavior: "auto"
          });

          window.setTimeout(() => {
            isResettingRef.current = false;
          }, 0);
        }, 180);
      }
    };

    const initialIndex = categoryCount > 1 ? categoryCount : 0;
    const cards = container.querySelectorAll<HTMLElement>("[data-category-card='true']");
    const initialCard = cards[initialIndex];

    if (initialCard) {
      container.scrollTo({
        left: initialCard.offsetLeft,
        behavior: "auto"
      });
      setCurrentIndex(initialIndex);
    }

    syncCurrentIndex();
    container.addEventListener("scroll", syncCurrentIndex, { passive: true });

    return () => {
      container.removeEventListener("scroll", syncCurrentIndex);

      if (scrollResetTimeoutRef.current !== null) {
        window.clearTimeout(scrollResetTimeoutRef.current);
      }
    };
  }, [categoryCount, normalizeIndex]);

  useEffect(() => {
    if (categoryCount <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      scrollToRenderedIndex(currentIndex + 1);
    }, 3200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [categoryCount, currentIndex, scrollToRenderedIndex]);

  const scrollByStep = (direction: -1 | 1) => {
    scrollToRenderedIndex(currentIndex + direction);
  };
  const activeDotIndex = normalizeIndex(currentIndex);

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
          {loopedCategories.map((category, index) => (
            <Link
              key={`${category.title}-${index}`}
              href={category.shopHref ?? "/shop"}
              data-category-card="true"
              className="relative block h-[240px] w-[220px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] bg-[#efe5d7] sm:h-[270px] sm:w-[250px] lg:h-[300px] lg:w-[calc((100%-6rem)/4)]"
              style={{
                backgroundImage: category.imageUrl
                  ? `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.28)), url('${category.imageUrl}')`
                  : undefined,
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

      {categoryCount > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4">
          {categories.map((category, index) => (
            <button
              key={category.title}
              type="button"
              aria-label={`Go to ${category.title}`}
              onClick={() => scrollToRenderedIndex(categoryCount + index)}
              className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                index === activeDotIndex ? "bg-black" : "bg-black/20"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
