"use client";

import { useFavorites } from "@/components/favorites-provider";

export function FavoriteToggleButton({
  sku,
  className = "",
  size = "default"
}: {
  sku: string;
  className?: string;
  size?: "default" | "large";
}) {
  const { isFavorite, isReady, toggleFavorite } = useFavorites();
  const active = isFavorite(sku);
  const buttonSize = size === "large" ? "h-12 w-12" : "h-11 w-11";
  const iconSize = size === "large" ? "h-5 w-5" : "h-[1.05rem] w-[1.05rem]";

  return (
    <button
      type="button"
      aria-label={active ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={active}
      disabled={!isReady}
      onClick={() => toggleFavorite(sku)}
      className={`inline-flex ${buttonSize} items-center justify-center rounded-full border border-white/65 bg-[#fbf4e8]/88 text-[#3f4738] shadow-[0_14px_32px_rgba(31,26,23,0.12)] backdrop-blur-sm transition-all duration-300 hover:bg-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      <HeartIcon
        className={`${iconSize} transition-colors duration-300 ${active ? "fill-[#bf5c58] text-[#bf5c58]" : "fill-transparent text-[#3f4738]"}`}
      />
    </button>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 20.4 4.95 13.7a4.73 4.73 0 0 1 0-6.9 4.99 4.99 0 0 1 7.05 0L12 7l.01-.2a4.99 4.99 0 0 1 7.04 0 4.72 4.72 0 0 1 0 6.9L12 20.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
