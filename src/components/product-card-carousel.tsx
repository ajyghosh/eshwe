"use client";

import { useEffect, useRef, useState } from "react";

import { CatalogueProductCard } from "@/components/catalogue-product-card";
import type { Saree } from "@/types/saree";

export function ProductCardCarousel({ products }: { products: Saree[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateActiveIndex = () => {
      const cards = container.querySelectorAll<HTMLElement>("[data-product-card='true']");

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
    if (products.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextIndex = activeIndex === products.length - 1 ? 0 : activeIndex + 1;

      scrollToCard(nextIndex);
    }, 3200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeIndex, products.length]);

  const scrollToCard = (index: number) => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const cards = container.querySelectorAll<HTMLElement>("[data-product-card='true']");
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
        ? activeIndex === products.length - 1
          ? 0
          : activeIndex + 1
        : activeIndex === 0
          ? products.length - 1
          : activeIndex - 1;

    scrollToCard(nextIndex);
  };

  return (
    <div>
      <div className="relative mx-auto max-w-6xl">
        <button
          type="button"
          aria-label="Previous product"
          onClick={() => scrollByStep(-1)}
          className="absolute left-3 top-[32%] z-10 -translate-y-1/2 text-6xl leading-none text-[#5e684f] transition-opacity duration-300 hover:opacity-70 sm:left-5 sm:text-7xl"
        >
          ‹
        </button>

        <div
          ref={containerRef}
          className="hide-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 sm:gap-8"
        >
          {products.map((product) => (
            <div
              key={product.id ?? product.sku}
              data-product-card="true"
              className="w-[220px] shrink-0 snap-start sm:w-[250px] lg:w-[calc((100%-6rem)/4)]"
            >
              <CatalogueProductCard product={product} />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next product"
          onClick={() => scrollByStep(1)}
          className="absolute right-3 top-[32%] z-10 -translate-y-1/2 text-6xl leading-none text-[#5e684f] transition-opacity duration-300 hover:opacity-70 sm:right-5 sm:text-7xl"
        >
          ›
        </button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        {products.map((product, index) => (
          <button
            key={product.id ?? product.sku}
            type="button"
            aria-label={`Go to ${product.name}`}
            onClick={() => scrollToCard(index)}
            className={`h-3 w-3 rounded-full transition-colors duration-300 ${
              index === activeIndex ? "bg-[#5e684f]" : "bg-[#5e684f]/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
