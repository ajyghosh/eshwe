"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CatalogueProductCard } from "@/components/catalogue-product-card";
import type { Saree } from "@/types/saree";

export function ProductCardCarousel({
  products,
  buttonLabel,
  showDetailButton = true,
  cardClassName = "w-[220px] shrink-0 snap-start sm:w-[250px] lg:w-[calc((100%-6rem)/4)]",
  maxWidthClassName = "max-w-6xl"
}: {
  products: Saree[];
  buttonLabel?: string;
  showDetailButton?: boolean;
  cardClassName?: string;
  maxWidthClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollResetTimeoutRef = useRef<number | null>(null);
  const isResettingRef = useRef(false);
  const productCount = products.length;
  const loopedProducts = productCount > 1 ? [...products, ...products, ...products] : products;
  const [currentIndex, setCurrentIndex] = useState(productCount > 1 ? productCount : 0);

  const normalizeIndex = useCallback(
    (index: number) => {
      if (productCount === 0) {
        return 0;
      }

      return ((index % productCount) + productCount) % productCount;
    },
    [productCount]
  );

  const scrollToRenderedIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const cards = container.querySelectorAll<HTMLElement>("[data-product-card='true']");

      if (cards.length === 0) {
        return;
      }

      const targetIndex =
        productCount > 1 && (index < 0 || index >= cards.length)
          ? productCount + normalizeIndex(index)
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
    [normalizeIndex, productCount]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || productCount === 0) {
      return;
    }

    const syncCurrentIndex = () => {
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

      setCurrentIndex(closestIndex);

      if (productCount > 1) {
        if (scrollResetTimeoutRef.current !== null) {
          window.clearTimeout(scrollResetTimeoutRef.current);
        }

        scrollResetTimeoutRef.current = window.setTimeout(() => {
          if (isResettingRef.current) {
            return;
          }

          const needsReset = closestIndex < productCount || closestIndex >= productCount * 2;

          if (!needsReset) {
            return;
          }

          const resetIndex = productCount + normalizeIndex(closestIndex);
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

    const initialIndex = productCount > 1 ? productCount : 0;
    const cards = container.querySelectorAll<HTMLElement>("[data-product-card='true']");
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
  }, [normalizeIndex, productCount]);

  useEffect(() => {
    if (productCount <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      scrollToRenderedIndex(currentIndex + 1);
    }, 3200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentIndex, productCount, scrollToRenderedIndex]);

  const scrollByStep = (direction: -1 | 1) => {
    scrollToRenderedIndex(currentIndex + direction);
  };
  const activeDotIndex = normalizeIndex(currentIndex);

  return (
    <div>
      <div className={`relative mx-auto ${maxWidthClassName}`}>
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
          {loopedProducts.map((product, index) => (
            <div
              key={`${product.id ?? product.sku}-${index}`}
              data-product-card="true"
              className={cardClassName}
            >
              <CatalogueProductCard
                product={product}
                buttonLabel={buttonLabel}
                showDetailButton={showDetailButton}
              />
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

      {productCount > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4">
          {products.map((product, index) => (
            <button
              key={product.id ?? product.sku}
              type="button"
              aria-label={`Go to ${product.name}`}
              onClick={() => scrollToRenderedIndex(productCount + index)}
              className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                index === activeDotIndex ? "bg-[#5e684f]" : "bg-[#5e684f]/20"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
