"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useCart } from "@/components/cart-provider";
import { rememberPwaProductVisit, restorePwaShoppingPosition } from "@/lib/pwa-shopping-navigation";
import { MobileContactButton } from "@/components/mobile-contact-button";
import {
  buildAppCheckoutHref,
  buildAppAccountHref,
  buildAppFavoritesHref,
  buildAppHomeHref,
  buildAppPrivacyHref,
  buildAppReturnPolicyHref,
  buildAppSearchHref,
  buildAppTermsHref
} from "@/lib/mobile-app-routes";

type MobileAppTab = "home" | "categories" | "favorites" | "account";

const tabItems: Array<{
  href: string;
  icon: (active: boolean) => ReactNode;
  key: MobileAppTab;
  label: string;
}> = [
  {
    key: "home",
    label: "Home",
    href: buildAppHomeHref(),
    icon: (active) => <HomeIcon active={active} />
  },
  {
    key: "categories",
    label: "Categories",
    href: buildAppSearchHref(),
    icon: (active) => <CategoryIcon active={active} />
  },
  {
    key: "favorites",
    label: "Wishlist",
    href: buildAppFavoritesHref(),
    icon: (active) => <HeartIcon active={active} />
  },
  {
    key: "account",
    label: "Account",
    href: buildAppAccountHref(),
    icon: (active) => <ProfileIcon active={active} />
  }
];

export function MobileAppShell({
  children,
  activeTab,
  showBottomNav = true,
  showFooter = true
}: {
  children: ReactNode;
  activeTab?: MobileAppTab;
  showBottomNav?: boolean;
  showFooter?: boolean;
}) {
  const pathname = usePathname();
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame) return restorePwaShoppingPosition(frame);
  }, [pathname, children]);

  return (
    <main className="mobile-app relative min-h-screen bg-[#fffaf2] text-[#243124]" onClickCapture={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (link && (!link.target || link.target === "_self")) rememberPwaProductVisit(link.href);
    }}>
      <div ref={frameRef} className="mobile-app-frame relative mx-auto min-h-screen max-w-[440px] bg-[#fffaf2]">
        <div
          key={pathname ?? "/app"}
          className={`mobile-app-page-enter ${showBottomNav ? "pb-[calc(5.6rem+env(safe-area-inset-bottom))]" : "pb-[calc(6.8rem+env(safe-area-inset-bottom))]"}`}
        >
          {children}
          {showFooter ? <MobileAppFooter /> : null}
        </div>
        <MobileFloatingCartButton />
        {showBottomNav ? <MobileBottomNav activeTab={activeTab} /> : null}
      </div>
    </main>
  );
}

function MobileBottomNav({ activeTab }: { activeTab?: MobileAppTab }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="mobile-app-tabs fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-[440px] px-3 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5">
        <div className="grid grid-cols-4 gap-1">
          {tabItems.map((item) => {
            const active =
              activeTab === item.key ||
              (activeTab === undefined && normalizePathname(pathname) === normalizePathname(item.href));

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`mobile-app-tab flex flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2 text-[0.75rem] transition-colors duration-200 ${
                  active ? "text-[#3f513b]" : "text-[#73796d]"
                }`}
              >
                <span className={`mobile-app-tab-icon ${active ? "mobile-app-tab-icon-active" : ""}`}>
                  {item.icon(active)}
                </span>
                <span className={active ? "font-semibold" : "font-medium"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function normalizePathname(pathname: string | null) {
  const resolvedPathname = pathname ?? "/";

  return resolvedPathname.endsWith("/") && resolvedPathname !== "/" ? resolvedPathname.slice(0, -1) : resolvedPathname;
}

function MobileFloatingCartButton() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const normalizedPathname = normalizePathname(pathname);
  const isHomeScreen = normalizedPathname === "/app";
  const [hasScrolledPastHomeHeader, setHasScrolledPastHomeHeader] = useState(false);

  useEffect(() => {
    if (!isHomeScreen) {
      setHasScrolledPastHomeHeader(false);
      return;
    }

    const updateVisibility = () => setHasScrolledPastHomeHeader(window.scrollY > 160);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, [isHomeScreen]);

  if (
    totalItems <= 0 ||
    normalizedPathname === "/app/checkout" ||
    normalizedPathname === "/app/order-confirmation" ||
    (isHomeScreen && !hasScrolledPastHomeHeader)
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.2rem+env(safe-area-inset-bottom))] z-50">
      <div className="relative mx-auto max-w-[440px]">
        <Link
          href={buildAppCheckoutHref()}
          aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
          className="mobile-app-floating-bag pointer-events-auto absolute bottom-0 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e4dfd4] bg-[#fffdf8] text-[#5e684f] transition-transform duration-200 active:scale-95"
        >
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[#fffaf2] bg-[#a8574d] px-2 text-sm font-semibold leading-none text-[#fbf4e8] shadow-[0_10px_20px_rgba(89,45,36,0.18)]">
            {totalItems}
          </span>
          <CartIcon />
        </Link>
      </div>
    </div>
  );
}

function MobileAppFooter() {
  return (
      <footer className="mobile-app-footer px-4 pb-4 pt-6">
        <div className="border-t border-[#e8e3d9] pt-3">
          <div className="grid grid-cols-2 gap-x-3 text-[0.8rem] font-medium text-[#626e5b]">
            <MobileContactButton label="Contact" className="min-h-11 rounded-lg px-2 py-3 text-left transition-colors duration-200 hover:bg-[#f1eee5]" />
            <Link href={buildAppTermsHref()} className="min-h-11 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-[#f1eee5]">
              Terms
            </Link>
            <Link href={buildAppPrivacyHref()} className="min-h-11 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-[#f1eee5]">
              Privacy
            </Link>
            <Link href={buildAppReturnPolicyHref()} className="min-h-11 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-[#f1eee5]">
              Shipping & Returns
            </Link>
          </div>

          <p className="mt-3 px-2 text-[0.72rem] text-[#74786c]">© 2026 eshwe Saree Studio</p>
        </div>
      </footer>

  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
      <path d="m4 10.2 8-6.2 8 6.2V20H4z" />
      <path d="M9.4 20v-5.4h5.2V20" />
    </svg>
  );
}

function CategoryIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4.3" y="4.3" width="6.4" height="6.4" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="13.3" y="4.3" width="6.4" height="6.4" rx="1.5" />
      <rect x="4.3" y="13.3" width="6.4" height="6.4" rx="1.5" />
      <rect x="13.3" y="13.3" width="6.4" height="6.4" rx="1.5" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
      <path d="M12 20.2 5 13.6a4.6 4.6 0 0 1 0-6.7 4.8 4.8 0 0 1 6.9 0l.1.2.1-.2a4.8 4.8 0 0 1 6.9 0 4.6 4.6 0 0 1 0 6.7Z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8.2" r="3.2" fill={active ? "currentColor" : "none"} />
      <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" />
    </svg>
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
