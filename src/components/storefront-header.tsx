"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { createCustomerMessage } from "@/lib/customer-messages";

export function StorefrontHeader({ absolute = false }: { absolute?: boolean }) {
  const pathname = usePathname();
  const { user, loading, signIn, signOut } = useAuthSession();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const headerClassName = absolute
    ? "fixed inset-x-0 top-0 z-30 border-b border-white/45 bg-[rgba(251,247,239,0.68)] backdrop-blur-md"
    : "fixed inset-x-0 top-0 z-30 border-b border-white/45 bg-[rgba(251,247,239,0.78)] backdrop-blur-md";
  const shouldHighlightSignIn = pathname.startsWith("/payment") && !user;

  useEffect(() => {
    if (!contactNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setContactNotice(null);
      setContactDialogOpen(false);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contactNotice]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setAuthError(null);
  }, [pathname]);

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!contactEmail.trim() || !contactPhone.trim() || !contactMessage.trim()) {
      setContactError("Email, phone, and message are required.");
      return;
    }

    setContactSubmitting(true);
    setContactError(null);

    try {
      await createCustomerMessage({
        email: contactEmail,
        phone: contactPhone,
        message: contactMessage,
        sourcePath: pathname || "/"
      });
      setContactEmail("");
      setContactPhone("");
      setContactMessage("");
      setContactNotice("Thank you for reaching out. We will get back to you soon.");
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Sending message failed.");
    } finally {
      setContactSubmitting(false);
    }
  }

  async function handleHeaderSignIn() {
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      await signIn();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleHeaderSignOut() {
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      await signOut();
      setAccountMenuOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  return (
    <>
      {absolute ? null : <div aria-hidden="true" className="h-[92px] sm:h-[68px]" />}

      <header className={headerClassName}>
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex w-full flex-col gap-1.5 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">
            <Link
              href="/"
              className="flex w-fit shrink-0 items-center rounded-full border border-[#5e684f]/38 bg-[#fbf4e8] p-1 ring-1 ring-[#5e684f]/12"
            >
              <Image
                src="/eshwelogo-transparent.png"
                alt="eshwe logo"
                width={128}
                height={128}
                priority
                className="h-auto w-[42px] sm:w-[48px]"
              />
            </Link>

            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.86rem] font-normal tracking-[0.06em] text-[#667056] sm:justify-end sm:text-[0.96rem]">
              <HeaderLink href="/" label="Home" active={pathname === "/"} />
              <HeaderLink href="/shop" label="Shop" active={pathname.startsWith("/shop")} />
              <button
                type="button"
                onClick={() => {
                  setContactDialogOpen(true);
                  setContactError(null);
                  setContactNotice(null);
                }}
                className="transition-colors duration-300 hover:text-[#4f5942]"
              >
                Contact Us
              </button>
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d6ccb9] bg-[#fbf7ef] px-3 py-1 text-[0.84rem] font-normal tracking-normal text-[#4f5942]"
                  >
                    <span>{getDisplayName(user.displayName, user.email)}</span>
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-[1.2rem] border border-[#ddd1c0] bg-[#fbf7ef] p-2 shadow-[0_20px_45px_rgba(63,71,56,0.16)]">
                      <p className="px-3 pb-2 pt-1 text-xs leading-5 text-[#7d876f]">{user.email}</p>
                      <button
                        type="button"
                        onClick={() => void handleHeaderSignOut()}
                        disabled={authSubmitting}
                        className="w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8] disabled:opacity-60"
                      >
                        {authSubmitting ? "Signing Out" : "Sign Out"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleHeaderSignIn()}
                  disabled={loading || authSubmitting}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[0.84rem] font-normal tracking-normal disabled:opacity-60 ${
                    shouldHighlightSignIn
                      ? "border border-[#5e684f] bg-[#5e684f] text-[#fbf4e8] shadow-[0_10px_24px_rgba(94,104,79,0.2)]"
                      : "border border-[#d6ccb9] bg-[#fbf7ef] text-[#4f5942]"
                  }`}
                >
                  {loading || authSubmitting ? "Opening Google" : "Sign In"}
                </button>
              )}
            </nav>
          </div>
          {authError ? <p className="px-4 pb-2 text-sm text-[#9d4b45] sm:px-6 lg:px-7">{authError}</p> : null}
        </div>
      </header>

      {contactDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3f4738]/36 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl rounded-[2rem] border border-[#dfd2c1] bg-[#fbf4e8] p-6 shadow-[0_30px_90px_rgba(63,71,56,0.22)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  CONTACT US
                </p>
                <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
                  Share your query and we will get back to you soon.
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setContactDialogOpen(false)}
                className="brand-caption rounded-full border border-[#d6ccb9] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#5e684f]"
              >
                CLOSE
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleContactSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Email</span>
                  <input
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    type="email"
                    className={contactInputClassName}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Phone Number</span>
                  <input
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    type="tel"
                    className={contactInputClassName}
                    placeholder="+91 98765 43210"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Message</span>
                <textarea
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                  rows={5}
                  className={`${contactInputClassName} h-auto resize-none py-3`}
                  placeholder="Tell us what you need help with."
                />
              </label>

              {contactError ? <p className="text-sm text-[#9d4b45]">{contactError}</p> : null}
              {contactNotice ? <p className="text-sm text-[#4d6a41]">{contactNotice}</p> : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
                >
                  {contactSubmitting ? "SENDING..." : "SEND MESSAGE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeaderLink({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={active ? "text-[#4f5942]" : "transition-colors duration-300 hover:text-[#4f5942]"}>
      {label}
    </Link>
  );
}

function getDisplayName(displayName?: string | null, email?: string | null) {
  const preferredName = displayName?.trim();

  if (preferredName) {
    const [firstName] = preferredName.split(/\s+/);
    return firstName || preferredName;
  }

  if (email) {
    return email.split("@")[0] || "Account";
  }

  return "Account";
}

const contactInputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
