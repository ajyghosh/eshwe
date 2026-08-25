"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart-provider";

export function FloatingBagButton() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const normalizedPathname = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const [visibleAfterHero, setVisibleAfterHero] = useState(normalizedPathname !== "/");

  useEffect(() => {
    if (normalizedPathname !== "/") {
      setVisibleAfterHero(true);
      return;
    }

    setVisibleAfterHero(false);

    const handleHeroReady = () => {
      setVisibleAfterHero(true);
    };

    window.addEventListener("eshwe:home-hero-ready", handleHeroReady);

    return () => {
      window.removeEventListener("eshwe:home-hero-ready", handleHeroReady);
    };
  }, [normalizedPathname]);

  if (
    totalItems <= 0 ||
    !visibleAfterHero ||
    normalizedPathname === "/checkout" ||
    normalizedPathname === "/payment" ||
    normalizedPathname === "/owner" ||
    normalizedPathname.startsWith("/owner/")
  ) {
    return null;
  }

  return (
    <Link
      href="/checkout"
      aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
      className="fixed bottom-5 right-4 z-40 inline-flex h-12 w-12 items-center justify-center text-[#68735b] transition-transform duration-200 hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
    >
      <span className="absolute -top-1 left-1/2 inline-flex h-7 min-w-7 -translate-x-[12%] items-center justify-center rounded-full bg-[#68735b] px-2 text-sm font-semibold leading-none text-[#fbf4e8] shadow-[0_10px_20px_rgba(63,71,56,0.18)]">
        {totalItems}
      </span>
      <CartIcon />
    </Link>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 8.25h11l-1 10h-9z" />
      <path d="M9 8.25V7a3 3 0 0 1 6 0v1.25" />
      <path d="M9.25 12.25h.01" />
      <path d="M14.75 12.25h.01" />
    </svg>
  );
}
