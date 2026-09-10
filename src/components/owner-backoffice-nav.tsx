"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/catalogue", label: "Catalogue" },
  { href: "/owner/storefront", label: "Storefront" },
  { href: "/owner/orders", label: "Orders" },
  { href: "/owner/messages", label: "Messages" },
  { href: "/owner/waitlist", label: "Waitlist" },
  { href: "/owner/access", label: "Access" }
];

type OwnerBackofficeBadge = {
  value: number | string;
  tone?: "alert" | "neutral";
};

type OwnerBackofficeNavProps = {
  badges?: Record<string, OwnerBackofficeBadge | number | string | undefined>;
  className?: string;
};

export function OwnerBackofficeNav({ badges = {}, className = "" }: OwnerBackofficeNavProps) {
  const pathname = usePathname() ?? "/owner";

  return (
    <nav
      aria-label="Owner navigation"
      className={`owner-navigation hide-scrollbar flex gap-2 overflow-x-auto ${className}`}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname === `${item.href}/`;
        const rawBadge = badges[item.href];
        const badge =
          rawBadge !== undefined && typeof rawBadge === "object" && "value" in rawBadge
            ? rawBadge
            : rawBadge !== undefined
              ? { value: rawBadge, tone: "neutral" as const }
              : undefined;
        const badgeClassName =
          badge?.tone === "alert"
            ? "bg-[#a84c43] text-[#fff4ef]"
            : isActive
              ? "bg-[#fbf4e8]/14 text-[#fbf4e8]"
              : "bg-[#e8ddca] text-[#5e684f]";

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-[1.1rem] px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "bg-[#5e684f] text-[#fbf4e8]"
                : "bg-[#fbf7ef] text-[#4f5942] hover:bg-[#f1e8d8]"
            }`}
          >
            <span>{item.label}</span>
            {badge !== undefined ? (
              <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClassName}`}>
                {badge.value}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
