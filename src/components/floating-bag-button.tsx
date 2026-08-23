"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/cart-provider";

export function FloatingBagButton() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const normalizedPathname = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  if (totalItems <= 0 || normalizedPathname === "/checkout") {
    return null;
  }

  return (
    <Link
      href="/checkout"
      aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
      className="fixed bottom-5 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#5e684f] bg-[#fbf4e8] text-[#4f5942] shadow-[0_18px_45px_rgba(63,71,56,0.26)] transition-transform duration-200 hover:-translate-y-0.5 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    >
      <CartIcon />
      <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-[#5e684f] px-1.5 py-1 text-[0.68rem] font-semibold leading-none text-[#fbf4e8] sm:min-w-7 sm:text-[0.72rem]">
        {totalItems}
      </span>
    </Link>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 sm:h-7 sm:w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
