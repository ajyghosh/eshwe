"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useCart } from "@/components/cart-provider";
import { createCustomerMessage } from "@/lib/customer-messages";
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

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#fffaf2] text-[#243124]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.16)] blur-3xl" />
        <div className="absolute right-[-5rem] top-40 h-52 w-52 rounded-full bg-[rgba(213,196,164,0.1)] blur-3xl" />
        <div className="absolute bottom-12 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[rgba(94,104,79,0.08)] blur-3xl" />
      </div>

      <div className="relative mx-auto min-h-screen max-w-[440px] border-x border-[rgba(214,203,185,0.45)] bg-[#fffaf2] shadow-[0_30px_120px_rgba(94,104,79,0.14)]">
        <div
          key={pathname ?? "/app"}
          className={`mobile-app-page-enter ${showBottomNav ? "pb-[calc(5.6rem+env(safe-area-inset-bottom))]" : ""}`}
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(214,203,185,0.72)] bg-[rgba(255,252,246,0.98)]">
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
                className={`flex flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2 text-[0.68rem] transition-all duration-200 ${
                  active ? "bg-[#f1f5eb] text-[#5e684f]" : "text-[#2b2a29]"
                }`}
              >
                {item.icon(active)}
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

  if (
    totalItems <= 0 ||
    normalizedPathname === "/app/checkout" ||
    normalizedPathname === "/app/order-confirmation"
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.2rem+env(safe-area-inset-bottom))] z-50">
      <div className="mx-auto max-w-[440px]">
        <Link
          href={buildAppCheckoutHref()}
          aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
          className="pointer-events-auto absolute right-4 inline-flex h-12 w-12 items-center justify-center text-[#68735b] transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="absolute -top-1 left-1/2 inline-flex h-7 min-w-7 -translate-x-[12%] items-center justify-center rounded-full bg-[#a8574d] px-2 text-sm font-semibold leading-none text-[#fbf4e8] shadow-[0_10px_20px_rgba(89,45,36,0.18)]">
            {totalItems}
          </span>
          <CartIcon />
        </Link>
      </div>
    </div>
  );
}

function MobileAppFooter() {
  const pathname = usePathname();
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    setContactOpen(false);
  }, [pathname]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !phone.trim() || !message.trim()) {
      setError("Email, phone, and message are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createCustomerMessage({
        email,
        phone,
        message,
        sourcePath: pathname || "/app/"
      });
      setEmail("");
      setPhone("");
      setMessage("");
      setNotice("Your message has been sent.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sending message failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <footer className="px-4 pb-5 pt-5">
        <div className="relative overflow-hidden rounded-[1.9rem] border border-[#708065] bg-[#5a6851] px-5 py-5 text-[#f8ecd2] shadow-[0_16px_34px_rgba(58,67,50,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,245,222,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,244,232,0.08),transparent_28%)]" />

          <div className="relative z-10">
            <p className="brand-copy text-[1.2rem] text-[#f8ecd2]">eshwe</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-[#f8f1e3]/82">Policies, support, and store information in one place.</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[0.86rem] font-medium text-[#f8ecd2]">
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="rounded-[0.95rem] bg-[#66735c] px-3 py-3 text-left transition-colors duration-200 hover:bg-[#718065]"
              >
                Contact
              </button>
              <Link href={buildAppTermsHref()} className="rounded-[0.95rem] bg-[#66735c] px-3 py-3 transition-colors duration-200 hover:bg-[#718065]">
                Terms
              </Link>
              <Link href={buildAppPrivacyHref()} className="rounded-[0.95rem] bg-[#66735c] px-3 py-3 transition-colors duration-200 hover:bg-[#718065]">
                Privacy
              </Link>
              <Link href={buildAppReturnPolicyHref()} className="rounded-[0.95rem] bg-[#66735c] px-3 py-3 transition-colors duration-200 hover:bg-[#718065]">
                Shipping & Returns
              </Link>
            </div>

            <p className="mt-4 text-[0.76rem] text-[#f8f1e3]/68">© 2026 eshwe Saree Studio</p>
          </div>
        </div>
      </footer>

      {contactOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-[rgba(36,49,36,0.3)] backdrop-blur-sm"
          onClick={() => setContactOpen(false)}
        >
          <div className="absolute inset-x-0 bottom-0 px-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <div
              className="mx-auto max-w-[430px] rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffaf2_0%,#f8f0e4_100%)] px-5 pb-5 pt-3 shadow-[0_-18px_48px_rgba(47,40,32,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-16 rounded-full bg-[#d8ccb8]" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Contact</p>
                  <p className="mt-2 text-[0.92rem] text-[#68735e]">Send a message without leaving the app.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3eee3] text-[#5e684f]"
                  aria-label="Close contact form"
                >
                  <CloseIcon />
                </button>
              </div>

              <form className="mt-5 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 text-[16px] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Phone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="h-12 w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 text-[16px] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Tell us what you need help with."
                    className="w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 py-3 text-[16px] leading-[1.45] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>

                {error ? <p className="text-[0.86rem] text-[#9d4b45]">{error}</p> : null}
                {notice ? <p className="text-[0.86rem] text-[#4d6a41]">{notice}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="brand-caption rounded-[1rem] bg-[#5e684f] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
                  >
                    {submitting ? "SENDING" : "SEND MESSAGE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactOpen(false)}
                    className="brand-caption rounded-[1rem] border border-[#d7ccb9] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#56624d]"
                  >
                    CLOSE
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
