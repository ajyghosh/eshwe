"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { getCustomerAuthDisplayLabel, syncCustomerDisplayName } from "@/lib/auth";
import { sendCustomerOtp, verifyCustomerOtp } from "@/lib/customer-auth";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import { createCustomerMessage } from "@/lib/customer-messages";
import { subscribeToCategoryCards } from "@/lib/homepage";
import { buildShopHref } from "@/lib/storefront-routes";
import type { CategoryCard } from "@/types/homepage";

type CreateAccountFormState = {
  fullName: string;
  email: string;
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
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, loading, signIn, signOut } = useAuthSession();
  const { totalItems } = useCart();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [createAccountSubmitting, setCreateAccountSubmitting] = useState(false);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [createAccountNotice, setCreateAccountNotice] = useState<string | null>(null);
  const [createAccountOtp, setCreateAccountOtp] = useState("");
  const [createAccountStep, setCreateAccountStep] = useState<"details" | "otp">("details");
  const [customerProfileName, setCustomerProfileName] = useState("");
  const [createAccountForm, setCreateAccountForm] = useState<CreateAccountFormState>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });
  const headerClassName = absolute
    ? `fixed inset-x-0 top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-700 ease-out ${
        contentVisible
          ? "bg-[rgba(251,244,232,0.82)] backdrop-blur-md"
          : "bg-[rgba(251,244,232,0.08)]"
      }`
    : "fixed inset-x-0 top-0 z-30 bg-[#fbf4e8]";

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
    setSearchPanelOpen(false);
    setAuthError(null);
    setSignOutDialogOpen(false);
    setCreateAccountDialogOpen(false);
    setCreateAccountError(null);
    setCreateAccountNotice(null);
    setCreateAccountOtp("");
    setCreateAccountStep("details");
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

  useEffect(() => {
    if (!user?.uid) {
      setCustomerProfileName("");
      return;
    }

    if (user.displayName?.trim()) {
      setCustomerProfileName("");
      return;
    }

    const userId = user.uid;
    let cancelled = false;

    async function loadCustomerProfileName() {
      try {
        const customerProfile = await getCustomerProfile(userId);

        if (cancelled) {
          return;
        }

        setCustomerProfileName(customerProfile?.fullName?.trim() ?? "");
      } catch {
        if (!cancelled) {
          setCustomerProfileName("");
        }
      }
    }

    void loadCustomerProfileName();

    return () => {
      cancelled = true;
    };
  }, [user?.displayName, user?.uid]);

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
      setSignOutDialogOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleHeaderSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuery = headerSearch.trim();
    setSearchPanelOpen(false);

    router.push(normalizedQuery ? `/shop/?q=${encodeURIComponent(normalizedQuery)}` : "/shop/");
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
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: ""
    });
    setCreateAccountError(null);
    setCreateAccountNotice(null);
    setCreateAccountOtp("");
    setCreateAccountStep("details");
  }

  function openCreateAccountDialog() {
    setAccountMenuOpen(false);
    setAuthError(null);
    setCreateAccountError(null);
    setCreateAccountNotice(null);
    setCreateAccountOtp("");
    setCreateAccountStep("details");
    setCreateAccountDialogOpen(true);
  }

  function openSignOutDialog() {
    setAccountMenuOpen(false);
    setAuthError(null);
    setSignOutDialogOpen(true);
  }

  function closeCreateAccountDialog() {
    setCreateAccountDialogOpen(false);
    resetCreateAccountForm();
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedForm = {
      fullName: createAccountForm.fullName.trim(),
      email: createAccountForm.email.trim(),
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
    setCreateAccountNotice(null);
    setAuthError(null);

    try {
      await sendCustomerOtp(normalizedForm.phone);
      setCreateAccountStep("otp");
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Creating account failed.");
    } finally {
      setCreateAccountSubmitting(false);
    }
  }

  async function handleCreateAccountOtpVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedForm = {
      fullName: createAccountForm.fullName.trim(),
      email: createAccountForm.email.trim(),
      phone: createAccountForm.phone.trim(),
      address: createAccountForm.address.trim(),
      city: createAccountForm.city.trim(),
      state: createAccountForm.state.trim(),
      pincode: createAccountForm.pincode.trim()
    };
    const normalizedOtp = createAccountOtp.trim();

    if (!normalizedOtp) {
      setCreateAccountError("Enter the code sent to your mobile number.");
      return;
    }

    setCreateAccountSubmitting(true);
    setCreateAccountError(null);
    setCreateAccountNotice(null);

    try {
      const signedInUser = await verifyCustomerOtp(normalizedForm.phone, normalizedOtp);
      const addressId = `address-${Date.now()}`;
      const email = normalizedForm.email;
      const phone = signedInUser.phoneNumber?.trim() || normalizedForm.phone;

      await syncCustomerDisplayName(normalizedForm.fullName);
      await saveCustomerProfile(signedInUser.uid, {
        ...normalizedForm,
        phone,
        email,
        selectedAddressId: addressId,
        addresses: [
          {
            id: addressId,
            label: "Primary Address",
            ...normalizedForm,
            phone,
            email
          }
        ]
      });

      closeCreateAccountDialog();
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Code verification failed.");
    } finally {
      setCreateAccountSubmitting(false);
    }
  }

  async function handleCreateAccountOtpResend() {
    const phone = createAccountForm.phone.trim();

    if (!phone) {
      setCreateAccountError("Enter a phone number first.");
      setCreateAccountStep("details");
      return;
    }

    setCreateAccountSubmitting(true);
    setCreateAccountError(null);

    try {
      await sendCustomerOtp(phone);
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Verification SMS could not be resent.");
    } finally {
      setCreateAccountSubmitting(false);
    }
  }

  const headerCategories = [
    {
      href: "/shop/",
      label: "Shop"
    },
    ...categoryCards.slice(0, 6).map((card) => ({
      href: buildShopHref({ browse: "curated", filter: card.shopFilter || card.title }),
      label: card.title
    }))
  ];
  const customerAuthLabel = user?.displayName?.trim() || customerProfileName || getCustomerAuthDisplayLabel(user);

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

              <nav className="flex shrink-0 items-center gap-2 text-[#667056]">
                <HeaderActionButton
                  label="Search"
                  icon={<HeaderSearchIcon />}
                  onClick={() => setSearchPanelOpen((current) => !current)}
                  active={searchPanelOpen}
                  iconOnly
                />
                <div ref={accountMenuRef} className="relative">
                  <HeaderActionButton
                    label="Account"
                    icon={<HeaderAccountIcon />}
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    active={accountMenuOpen}
                    disabled={loading || authSubmitting || createAccountSubmitting}
                    iconOnly
                  />

                  {accountMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-[1.2rem] border border-[#ddd1c0] bg-[#fbf7ef] p-2 shadow-[0_20px_45px_rgba(63,71,56,0.16)]">
                      {user ? (
                        <>
                          <p className="px-3 pb-2 pt-1 text-xs leading-5 text-[#7d876f]">{customerAuthLabel || "Signed in"}</p>
                          <Link
                            href="/account/"
                            onClick={() => setAccountMenuOpen(false)}
                            className="block w-full rounded-[0.95rem] px-3 py-2 text-left text-sm font-semibold text-[#4f5942] transition-colors duration-200 hover:bg-[#f1e8d8]"
                          >
                            My Profile
                          </Link>
                          <button
                            type="button"
                            onClick={openSignOutDialog}
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
                            {authSubmitting ? "Signing In" : "Continue with SMS"}
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
                <span aria-hidden="true" className="mx-1 h-12 w-px bg-[#d8ccb9]" />
                <Link
                  href="/checkout"
                  aria-label={`View bag with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
                  className="relative inline-flex h-10 w-10 items-center justify-center text-[#768068] transition-colors duration-200 hover:text-[#5e684f]"
                >
                  <HeaderCartIcon />
                  <span className="absolute -right-1.5 -top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-[#a8574d] px-1.5 py-1 text-[0.66rem] font-medium leading-none text-[#fbf4e8]">
                    {totalItems}
                  </span>
                </Link>
              </nav>
            </div>

            {searchPanelOpen ? (
              <div className="rounded-[1.35rem] border border-[#ddd1c0] bg-[#fffaf2] p-3 shadow-[0_18px_40px_rgba(94,104,79,0.08)]">
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleHeaderSearchSubmit}>
                  <label className="sr-only" htmlFor="header-search">
                    Search catalogue
                  </label>
                  <input
                    id="header-search"
                    value={headerSearch}
                    onChange={(event) => setHeaderSearch(event.target.value)}
                    placeholder="Search by saree name, fabric, color, wedding, gifting..."
                    className="h-11 min-w-0 flex-1 rounded-[1rem] border border-[#d9ccb8] bg-white px-4 text-sm text-[#2b2a29] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]"
                  />
                  <button
                    type="submit"
                    className="brand-caption inline-flex h-11 items-center justify-center rounded-[1rem] bg-[#5e684f] px-5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                  >
                    SEARCH CATALOGUE
                  </button>
                </form>
              </div>
            ) : null}

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

      <ConfirmationDialog
        open={signOutDialogOpen}
        title="Sign out of your account?"
        message="You will be logged out from this device and will need to sign in again to access your profile, addresses, and orders."
        confirmLabel="SIGN OUT"
        cancelLabel="STAY SIGNED IN"
        tone="neutral"
        pending={authSubmitting}
        onConfirm={() => void handleHeaderSignOut()}
        onClose={() => setSignOutDialogOpen(false)}
      />

      {createAccountDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3f4738]/36 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-[2rem] border border-[#dfd2c1] bg-[#fbf4e8] p-5 shadow-[0_30px_90px_rgba(63,71,56,0.22)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  CREATE ACCOUNT
                </p>
                <h2 className="brand-copy mt-2 text-[2rem] leading-[0.95] text-[#3f4738] sm:text-[2.7rem]">
                  Add your details and save your first address.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7861]">
                  We will connect this to your mobile sign-in and keep the address ready for checkout.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateAccountDialog}
                className="brand-caption shrink-0 rounded-full border border-[#d6ccb9] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#5e684f]"
              >
                CLOSE
              </button>
            </div>

            {createAccountStep === "details" ? (
              <form className="mt-5 space-y-4" onSubmit={handleCreateAccount}>
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
                    <span className="mb-2 block text-sm font-medium text-[#4f5942]">
                      Email <span className="text-[#8b8b7d]">(optional)</span>
                    </span>
                    <input
                      value={createAccountForm.email}
                      onChange={(event) => updateCreateAccountField("email", event.target.value)}
                      type="email"
                      className={contactInputClassName}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="block sm:col-span-2">
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
                    rows={3}
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
                    {createAccountSubmitting ? "SENDING SMS..." : "CREATE ACCOUNT"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleCreateAccountOtpVerification}>
                <label className="block max-w-sm">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">OTP</span>
                  <input
                    value={createAccountOtp}
                    onChange={(event) => setCreateAccountOtp(event.target.value)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={contactInputClassName}
                    placeholder="Enter OTP"
                  />
                </label>

                {createAccountError ? <p className="text-sm text-[#9d4b45]">{createAccountError}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={createAccountSubmitting}
                    className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
                  >
                    {createAccountSubmitting ? "VERIFYING..." : "VERIFY"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateAccountOtpResend()}
                    disabled={createAccountSubmitting}
                    className="brand-caption rounded-2xl border border-[#d6ccb9] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:opacity-60"
                  >
                    RESEND
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateAccountStep("details");
                      setCreateAccountError(null);
                      setCreateAccountNotice(null);
                      setCreateAccountOtp("");
                    }}
                    disabled={createAccountSubmitting}
                    className="brand-caption rounded-2xl border border-[#d6ccb9] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:opacity-60"
                  >
                    EDIT
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeaderActionButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  iconOnly = false
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center transition-colors duration-200 disabled:opacity-60 ${
        iconOnly ? "h-10 w-10" : "h-10 gap-2 rounded-full border px-4 text-sm font-medium"
      } ${
        active
          ? iconOnly
            ? "text-[#2b2a29]"
            : "border-[#5e684f] bg-[#eef1e8] text-[#2b2a29]"
          : iconOnly
            ? "text-[#768068] hover:text-[#5e684f]"
            : "border-[#d8cdbb] bg-[#fbf7ef] text-[#2b2a29] hover:bg-[#f1e8d8]"
      }`}
    >
      <span aria-hidden="true" className={iconOnly ? "" : "text-[#5e684f]"}>
        {icon}
      </span>
      {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
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
