"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_INITIAL_BATCH_SIZE = 12;
const DEFAULT_LOAD_MORE_BATCH_SIZE = 12;

export function useProgressiveProductGrid(
  totalItems: number,
  resetKey: string,
  options?: {
    initialBatchSize?: number;
    loadMoreBatchSize?: number;
  }
) {
  const initialBatchSize = options?.initialBatchSize ?? DEFAULT_INITIAL_BATCH_SIZE;
  const loadMoreBatchSize = options?.loadMoreBatchSize ?? DEFAULT_LOAD_MORE_BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(() => Math.min(initialBatchSize, totalItems));
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(Math.min(initialBatchSize, totalItems));
  }, [initialBatchSize, resetKey, totalItems]);

  const hasMore = visibleCount < totalItems;

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") {
      return;
    }

    const node = loadMoreRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        observer.disconnect();
        setVisibleCount((current) => Math.min(current + loadMoreBatchSize, totalItems));
      },
      {
        rootMargin: "320px 0px"
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreBatchSize, totalItems, visibleCount]);

  const visibleItemsCount = useMemo(() => Math.min(visibleCount, totalItems), [totalItems, visibleCount]);

  return {
    hasMore,
    loadMoreRef,
    visibleItemsCount
  };
}
