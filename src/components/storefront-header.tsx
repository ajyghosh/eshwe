"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { saveCustomerProfile } from "@/lib/customer-profiles";
import { createCustomerMessage } from "@/lib/customer-messages";
import { subscribeToCategoryCards } from "@/lib/homepage";
import { buildShopHref } from "@/lib/storefront-routes";
import type { CategoryCard } from "@/types/homepage";

type CreateAccountFormState = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export function StorefrontHeader({
  absolute = false,
  contentVisible = true
}: {
  absolute?: boolean;
  contentVisible?: boolean;
}) {
  const pathname = usePathname();
  const { user, loading, signIn, signOut } = useAuthSession();
  const { totalItems } = useCart();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [createAccountSubmitting, setCreateAccountSubmitting] = useState(false);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [createAccountForm, setCreateAccountForm] = useState<CreateAccountFormState>({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });
  const headerClassName = absolute
    ? `fixed inset-x-0 top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-700 ease-out ${
        contentVisible
          ? "border-b border-white/45 bg-[rgba(251,244,232,0.82)] backdrop-blur-md"
          : "border-b border-transparent bg-[rgba(251,244,232,0.08)]"
      }`
    : "fixed inset-x-0 top-0 z-30 border-b border-white/45 bg-[#fbf4e8]";

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
    setCreateAccountDialogOpen(false);
    setCreateAccountError(null);
  }, [pathname]);

  useEffect(() => {
    return subscribeToCategoryCards((cards) => {
      setCategoryCards(cards.filter((card) => card.active));
    });
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!accountMenuRef.current || accountMenuRef.current.contains(event.target as Node)) {
        return;
      }

      setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [accountMenuOpen]);

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
      setAccountMenuOpen(false);
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

  function updateCreateAccountField(field: keyof CreateAccountFormState, value: string) {
    setCreateAccountForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetCreateAccountForm() {
    setCreateAccountForm({
      fullName: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: ""
    });
    setCreateAccountError(null);
  }

  function openCreateAccountDialog() {
    setAccountMenuOpen(false);
    setAuthError(null);
    setCreateAccountError(null);
    setCreateAccountDialogOpen(true);
  }

  function closeCreateAccountDialog() {
    setCreateAccountDialogOpen(false);
    resetCreateAccountForm();
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedForm = {
      fullName: createAccountForm.fullName.trim(),
      phone: createAccountForm.phone.trim(),
      address: createAccountForm.address.trim(),
      city: createAccountForm.city.trim(),
      state: createAccountForm.state.trim(),
      pincode: createAccountForm.pincode.trim()
    };

    if (
      !normalizedForm.fullName ||
      !normalizedForm.phone ||
      !normalizedForm.address ||
      !normalizedForm.city ||
      !normalizedForm.state ||
      !normalizedForm.pincode
    ) {
      setCreateAccountError("Please complete all address details.");
      return;
    }

    setCreateAccountSubmitting(true);
    setCreateAccountError(null);
    setAuthError(null);

    try {
      const signedInUser = await signIn();
      const addressId = `address-${Date.now()}`;
      const email = signedInUser.email?.trim() ?? "";

      await saveCustomerProfile(signedInUser.uid, {
        ...normalizedForm,
        email,
        selectedAddressId: addressId,
        addresses: [
          {
            id: addressId,
            label: "Primary Address",
            ...normalizedForm,
            email
          }
        ]
      });

      closeCreateAccountDialog();
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Creating account failed.");
    } finally {
      setCreateAccountSubmitting(false);
    }
  }

  const headerCategories = [
    {
      href: "/shop/",
      label: "Sarees"
    },
    ...categoryCards.slice(0, 6).map((card) => ({
      href: buildShopHref({ browse: "curated", filter: card.shopFilter || card.title }),
      label: card.title
    }))
  ];

  return (
    <>
      {absolute ? null : <div aria-hidden="true" className="h-[92px] sm:h-[68px]" />}

      <header className={headerClassName}>
        <div
          className={`mx-auto w-full max-w-7xl transition-opacity duration-700 ease-out ${
            contentVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex w-full flex-col gap-2 px-4 py-2 sm:px-6 lg:px-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-5">
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

                {headerCategories.length > 0 ? (
                  <div className="hidden min-w-0 items-center gap-6 overflow-x-auto text-[0.9rem] text-[#2b2a29] lg:flex">
                    {headerCategories.map((category) => (
                      <Link
                        key={category.label}
                        href={category.href}
                        className="shrink-0 whitespace-nowrap transition-colors duration-200 hover:text-[#5e684f]"
                      >
                        {category.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              <nav className="flex shrink-0 items-center gap-3 text-[#667056]">
                <Link
                  href="/shop"
                  aria-label="Search catalogue"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2b2a29] transition-colors duration-200 hover:bg-[#f1e8d8]"
                >
                  <HeaderSearchIcon />
                </Link>
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    disabled={loading || authSubmitting || createAccountSubmitting}
                    aria-label={user ? "Account" : "Sign in"}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2b2a29] transition-colors duration-200 hover:bg-[#f1e8d8] disabled:opacity-60"
                  >
                    <HeaderAccountIcon />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-[1.2rem] border border-[#ddd1c0] bg-[#fbf7ef] p-2 shadow-[0_20px_45px_rgba(63,71,56,0.16)]">
                      {user ? (
                        <>
                          <p className="px-3 pb-2 pt-1 text-xs leading-5 text-[#7d876f]">{user.email}</p>
                          <Link
                            href="/account/"
                            onClick={() => setAccountMenuOpen(false)}
                            className="block w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8]"
                          >
                            My Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleHeaderSignOut()}
                            disabled={authSubmitting}
                            className="w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8] disabled:opacity-60"
                          >
                            {authSubmitting ? "Signing Out" : "Sign Out"}
                          </button>
                        </>
                      ) : (
                        <div className="min-w-[210px] space-y-1">
                          <button
                            type="button"
                            onClick={() => void handleHeaderSignIn()}
                            disabled={authSubmitting}
                            className="w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8] disabled:opacity-60"
                          >
                            {authSubmitting ? "Signing In" : "Sign In"}
                          </button>
                          <button
                            type="button"
                            onClick={openCreateAccountDialog}
                            disabled={createAccountSubmitting}
                            className="w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8] disabled:opacity-60"
                          >
                            Create Account
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <span aria-hidden="true" className="hidden h-10 w-px bg-[#d6ccb9] sm:block" />
                <Link
                  href="/checkout"
                  aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2b2a29] transition-colors duration-200 hover:bg-[#f1e8d8]"
                >
                  <HeaderCartIcon />
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#5e684f] px-1.5 py-0.5 text-[0.62rem] font-normal leading-none text-[#fbf4e8]">
                    {totalItems}
                  </span>
                </Link>
              </nav>
            </div>

            {headerCategories.length > 0 ? (
              <div className="flex gap-5 overflow-x-auto pb-1 text-[0.88rem] text-[#2b2a29] lg:hidden">
                {headerCategories.map((category) => (
                  <Link
                    key={category.label}
                    href={category.href}
                    className="shrink-0 whitespace-nowrap transition-colors duration-200 hover:text-[#5e684f]"
                  >
                    {category.label}
                  </Link>
                ))}
              </div>
            ) : null}
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

      {createAccountDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3f4738]/36 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[#dfd2c1] bg-[#fbf4e8] p-6 shadow-[0_30px_90px_rgba(63,71,56,0.22)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  CREATE ACCOUNT
                </p>
                <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
                  Add your details and save your first address.
                </h2>
                <p className="mt-3 text-sm text-[#6f7861]">
                  We will connect this to your Google sign-in and keep the address ready for checkout.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateAccountDialog}
                className="brand-caption rounded-full border border-[#d6ccb9] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#5e684f]"
              >
                CLOSE
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateAccount}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Full Name</span>
                  <input
                    value={createAccountForm.fullName}
                    onChange={(event) => updateCreateAccountField("fullName", event.target.value)}
                    type="text"
                    className={contactInputClassName}
                    placeholder="Your name"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Phone Number</span>
                  <input
                    value={createAccountForm.phone}
                    onChange={(event) => updateCreateAccountField("phone", event.target.value)}
                    type="tel"
                    className={contactInputClassName}
                    placeholder="+91 98765 43210"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Address</span>
                <textarea
                  value={createAccountForm.address}
                  onChange={(event) => updateCreateAccountField("address", event.target.value)}
                  rows={4}
                  className={`${contactInputClassName} h-auto resize-none py-3`}
                  placeholder="House / street / area"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">City</span>
                  <input
                    value={createAccountForm.city}
                    onChange={(event) => updateCreateAccountField("city", event.target.value)}
                    type="text"
                    className={contactInputClassName}
                    placeholder="City"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">State</span>
                  <input
                    value={createAccountForm.state}
                    onChange={(event) => updateCreateAccountField("state", event.target.value)}
                    type="text"
                    className={contactInputClassName}
                    placeholder="State"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Pincode</span>
                  <input
                    value={createAccountForm.pincode}
                    onChange={(event) => updateCreateAccountField("pincode", event.target.value)}
                    type="text"
                    inputMode="numeric"
                    className={contactInputClassName}
                    placeholder="Pincode"
                  />
                </label>
              </div>

              {createAccountError ? <p className="text-sm text-[#9d4b45]">{createAccountError}</p> : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={createAccountSubmitting}
                  className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
                >
                  {createAccountSubmitting ? "CREATING..." : "CREATE ACCOUNT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeaderCartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5.5 w-5.5"
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

function HeaderSearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function HeaderAccountIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19c1.9-3.12 4.21-4.68 7-4.68S17.1 15.88 19 19" />
      <path d="M5 19h14" />
    </svg>
  );
}

const contactInputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
