"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { formatCurrency } from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";

type CheckoutFormState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
};

type SavedAddress = Omit<CheckoutFormState, "notes">;

const emptyForm: CheckoutFormState = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  notes: ""
};

export function CheckoutPage() {
  const {
    items,
    subtotal,
    savings,
    shippingFee,
    packagingFee,
    total,
    updateQuantity,
    removeItem,
    clearCart
  } = useCart();
  const { user, loading, signIn, signOut } = useAuthSession();
  const [activeScreen, setActiveScreen] = useState<"bag" | "address">("bag");
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("new");
  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setActiveScreen("bag");
      setPaymentMessage(null);
    }
  }, [items.length]);

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      fullName: currentForm.fullName || user?.displayName || "",
      email: currentForm.email || user?.email || ""
    }));
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    const userId = user?.uid;
    const userDisplayName = user?.displayName ?? "";
    const userEmail = user?.email ?? "";

    if (!userId) {
      setSavedAddress(null);
      setAddressMode("new");
      setProfileLoading(false);
      return;
    }

    const activeUserId = userId;
    let isMounted = true;

    async function loadCustomerProfile() {
      setProfileLoading(true);
      setProfileError(null);

      try {
        const customerProfile = await getCustomerProfile(activeUserId);

        if (!isMounted) {
          return;
        }

        if (!customerProfile) {
          setSavedAddress(null);
          setAddressMode("new");
          return;
        }

        const nextSavedAddress = {
          fullName: customerProfile.fullName || userDisplayName,
          email: customerProfile.email || userEmail,
          phone: customerProfile.phone || "",
          address: customerProfile.address || "",
          city: customerProfile.city || "",
          state: customerProfile.state || "",
          pincode: customerProfile.pincode || ""
        };

        setSavedAddress(nextSavedAddress);
        setAddressMode("saved");
        setForm((currentForm) => ({
          ...currentForm,
          ...nextSavedAddress
        }));
        setProfileMessage("Saved address loaded from your account.");
      } catch (error) {
        if (isMounted) {
          setProfileError(error instanceof Error ? error.message : "Failed to load saved address.");
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    void loadCustomerProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.displayName, user?.email]);

  useEffect(() => {
    if (!profileMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setProfileMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [profileMessage]);

  const canUseNewAddress =
    items.length > 0 &&
    Boolean(
      form.fullName.trim() &&
        form.email.trim() &&
        form.phone.trim() &&
        form.address.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.pincode.trim()
    );
  const canProceedToPayment =
    items.length > 0 && (addressMode === "saved" ? Boolean(savedAddress) : canUseNewAddress);

  function handleFieldChange(field: keyof CheckoutFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleOpenAddressScreen() {
    if (items.length === 0) {
      return;
    }

    setPaymentMessage(null);
    setProfileError(null);
    setActiveScreen("address");
  }

  function handleUseSavedAddress() {
    if (!savedAddress) {
      return;
    }

    setAddressMode("saved");
    setProfileError(null);
    setForm((currentForm) => ({
      ...currentForm,
      ...savedAddress
    }));
  }

  function handleUseNewAddress() {
    setAddressMode("new");
    setProfileError(null);
  }

  async function handleCheckoutLogin() {
    setAuthSubmitting(true);
    setProfileError(null);

    try {
      await signIn();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleCheckoutSignOut() {
    setAuthSubmitting(true);
    setProfileError(null);

    try {
      await signOut();
      setAddressMode("new");
      setSavedAddress(null);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  function showRazorpayPlaceholder() {
    setPaymentMessage(
      `Razorpay placeholder: create an order for ${formatCurrency(total)} on the server, then open the checkout modal with this cart and customer data.`
    );
  }

  function handleSummaryButtonClick() {
    if (activeScreen === "bag") {
      handleOpenAddressScreen();
      return;
    }

    void handleProceedToPay();
  }

  async function handleProceedToPay() {
    if (addressMode === "saved") {
      if (!savedAddress) {
        setProfileError("No saved address found. Sign in or add a new address.");
        return;
      }

      setProfileError(null);
      setForm((currentForm) => ({
        ...currentForm,
        ...savedAddress
      }));
      showRazorpayPlaceholder();
      return;
    }

    if (!canUseNewAddress) {
      setProfileError("Complete the delivery details before continuing to payment.");
      return;
    }

    setProfileError(null);
    showRazorpayPlaceholder();
  }

  async function handleSaveAddressWithLogin() {
    if (!canUseNewAddress) {
      setProfileError("Complete the delivery details before saving the address.");
      return;
    }

    if (!user) {
      setAuthSubmitting(true);
      setProfileError(null);

      try {
        await signIn();
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : "Google sign-in failed.");
        setAuthSubmitting(false);
        return;
      }

      setAuthSubmitting(false);
    }

    const didSave = await saveProfile();

    if (!didSave) {
      return;
    }

    showRazorpayPlaceholder();
  }

  async function saveProfile() {
    if (!user?.uid) {
      setProfileError("Sign in with Gmail to save delivery details.");
      return false;
    }

    if (!canUseNewAddress) {
      setProfileError("Complete the delivery details before saving the address.");
      return false;
    }

    setProfileSaving(true);
    setProfileError(null);

    try {
      const nextSavedAddress = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim()
      };

      await saveCustomerProfile(user.uid, nextSavedAddress);
      setSavedAddress(nextSavedAddress);
      setAddressMode("saved");
      setProfileMessage("Address saved to your account.");
      return true;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save delivery details.");
      return false;
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              CHECKOUT
            </p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              {activeScreen === "bag" ? "Review your bag and continue to address." : "Delivery address and payment."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              {activeScreen === "bag"
                ? "Checkout starts with your bag. Address and login are handled only in the next step."
                : "Use saved address with Gmail or continue as a fast guest checkout without saving."}
            </p>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
            <div className="space-y-8">
              {activeScreen === "bag" ? (
                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="brand-copy text-2xl text-[#2b2a29]">Cart Items</h2>
                      <p className="mt-2 text-sm leading-6 text-[#667056]">
                        Review items, change quantity, and remove anything you do not want.
                      </p>
                    </div>

                    {items.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-sm font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-70"
                      >
                        Clear cart
                      </button>
                    ) : null}
                  </div>

                  {items.length === 0 ? (
                    <div className="mt-6 rounded-[1.6rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-8 text-center">
                      <p className="text-sm leading-7 text-[#667056]">
                        Your cart is empty. Add a few sarees from the catalogue to start checkout.
                      </p>
                      <Link
                        href="/shop"
                        className="brand-caption mt-5 inline-flex rounded-full bg-[#5e684f] px-6 py-3 text-[0.64rem] font-semibold tracking-[0.12em] text-[#fbf4e8]"
                      >
                        CONTINUE SHOPPING
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {items.map((item) => (
                        <article
                          key={item.sku}
                          className="grid gap-4 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-4 sm:grid-cols-[110px_minmax(0,1fr)]"
                        >
                          <div
                            className="aspect-[0.84] rounded-[1.15rem] bg-[#efe5d7]"
                            style={{
                              backgroundImage: item.primaryImageUrl
                                ? `linear-gradient(180deg, rgba(255,249,236,0.04), rgba(43,24,14,0.08)), url('${item.primaryImageUrl}')`
                                : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)",
                              backgroundPosition: "center",
                              backgroundSize: "cover"
                            }}
                          />

                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="brand-copy text-xl text-[#2b2a29]">{item.name}</p>
                                <p className="mt-1 text-sm text-[#667056]">
                                  {item.sku} · {item.fabric} · {item.color}
                                </p>
                              </div>

                              <div className="text-left sm:text-right">
                                <p className="text-lg font-semibold text-[#2b2a29]">
                                  {formatCurrency(item.price * item.quantity)}
                                </p>
                                {typeof item.originalPrice === "number" && item.originalPrice > item.price ? (
                                  <p className="text-sm text-[#8d8b87] line-through">
                                    {formatCurrency(item.originalPrice * item.quantity)}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="inline-flex items-center rounded-full border border-[#d6ccb9] bg-white/70 p-1">
                                <QuantityButton
                                  label="Decrease quantity"
                                  onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                                >
                                  −
                                </QuantityButton>
                                <span className="min-w-12 text-center text-sm font-semibold text-[#2b2a29]">
                                  {item.quantity}
                                </span>
                                <QuantityButton
                                  label="Increase quantity"
                                  onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                                >
                                  +
                                </QuantityButton>
                              </div>

                              <div className="flex items-center gap-4">
                                <Link
                                  href={buildProductDetailHref(item.slug)}
                                  className="text-sm font-medium text-[#5e684f] underline decoration-1 underline-offset-4"
                                >
                                  View product
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.sku)}
                                  className="text-sm font-medium text-[#9d4b45]"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                        DELIVERY ADDRESS
                      </p>
                      <h2 className="brand-copy mt-3 text-2xl text-[#2b2a29]">Address Options</h2>
                      <p className="mt-2 text-sm leading-6 text-[#667056]">
                        Save the address with Gmail or continue as a fast guest checkout without saving.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveScreen("bag")}
                      className="rounded-full border border-[#d6ccb9] bg-[#fbf7ef] px-5 py-3 text-sm font-semibold text-[#4f5942]"
                    >
                      Back to Bag
                    </button>
                  </div>

                  {user ? (
                    <div className="mt-6 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">SIGNED IN</p>
                          <p className="mt-2 text-base font-semibold text-[#2b2a29]">{user.displayName || user.email}</p>
                          <p className="mt-1 text-sm text-[#667056]">{user.email}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleCheckoutSignOut()}
                          disabled={authSubmitting}
                          className="rounded-full border border-[#d6ccb9] bg-[#fbf7ef] px-5 py-3 text-sm font-semibold text-[#4f5942] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {authSubmitting ? "Signing out" : "Use Guest Instead"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">RETURNING CUSTOMER</p>
                          <p className="mt-2 text-sm leading-6 text-[#667056]">
                            Already saved an address before? Sign in with Gmail and we will load it automatically.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleCheckoutLogin()}
                          disabled={loading || authSubmitting}
                          className="rounded-full bg-[#5e684f] px-5 py-3 text-sm font-semibold text-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading || authSubmitting ? "Opening Google" : "Login with Gmail"}
                        </button>
                      </div>
                    </div>
                  )}

                  {savedAddress ? (
                    <div className="mt-6 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">SAVED ADDRESS</p>
                          <p className="mt-3 text-base font-semibold text-[#2b2a29]">{savedAddress.fullName}</p>
                          <p className="mt-1 text-sm leading-6 text-[#667056]">
                            {savedAddress.address}, {savedAddress.city}, {savedAddress.state} - {savedAddress.pincode}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#667056]">
                            {savedAddress.phone} · {savedAddress.email}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:min-w-[220px]">
                          <button
                            type="button"
                            onClick={handleUseSavedAddress}
                            className={`rounded-full px-5 py-3 text-sm font-semibold ${
                              addressMode === "saved"
                                ? "bg-[#5e684f] text-[#fbf4e8]"
                                : "border border-[#d6ccb9] bg-[#fbf7ef] text-[#4f5942]"
                            }`}
                          >
                            Confirm Saved Address
                          </button>
                          <button
                            type="button"
                            onClick={handleUseNewAddress}
                            className={`rounded-full px-5 py-3 text-sm font-semibold ${
                              addressMode === "new"
                                ? "bg-[#5e684f] text-[#fbf4e8]"
                                : "border border-[#d6ccb9] bg-[#fbf7ef] text-[#4f5942]"
                            }`}
                          >
                            Add Different Address
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {profileMessage ? <p className="mt-4 text-sm text-[#5e684f]">{profileMessage}</p> : null}
                  {profileError ? <p className="mt-4 text-sm text-[#9d4b45]">{profileError}</p> : null}

                  {(addressMode === "new" || !savedAddress) ? (
                    <div className="mt-6">
                      <div className="grid gap-4">
                        <CheckoutInput
                          label="Full name"
                          value={form.fullName}
                          onChange={(value) => handleFieldChange("fullName", value)}
                        />
                        <CheckoutInput
                          label="Email"
                          type="email"
                          value={form.email}
                          onChange={(value) => handleFieldChange("email", value)}
                        />
                        <CheckoutInput
                          label="Phone"
                          type="tel"
                          value={form.phone}
                          onChange={(value) => handleFieldChange("phone", value)}
                        />
                        <CheckoutInput
                          label="Pincode"
                          value={form.pincode}
                          onChange={(value) => handleFieldChange("pincode", value)}
                        />
                        <CheckoutInput
                          label="Address"
                          value={form.address}
                          onChange={(value) => handleFieldChange("address", value)}
                        />
                        <CheckoutInput
                          label="City"
                          value={form.city}
                          onChange={(value) => handleFieldChange("city", value)}
                        />
                        <CheckoutInput
                          label="State"
                          value={form.state}
                          onChange={(value) => handleFieldChange("state", value)}
                        />
                        <CheckoutTextarea
                          label="Order notes"
                          value={form.notes}
                          onChange={(value) => handleFieldChange("notes", value)}
                        />
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => void handleProceedToPay()}
                          disabled={!canUseNewAddress}
                          className="rounded-full border border-[#d6ccb9] bg-[#fbf7ef] px-5 py-3 text-sm font-semibold text-[#4f5942] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Continue as Guest
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveAddressWithLogin()}
                          disabled={!canUseNewAddress || profileSaving || authSubmitting || profileLoading}
                          className="rounded-full bg-[#5e684f] px-5 py-3 text-sm font-semibold text-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {profileLoading || profileSaving || authSubmitting
                            ? "Processing"
                            : user
                              ? "Save Address and Continue"
                              : "Login, Save Address and Continue"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              )}
            </div>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-[#d9cebe] bg-[#fffaf2] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.1)] sm:p-7">
                <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  ORDER SUMMARY
                </p>

                <div className="mt-5 space-y-4 text-sm text-[#667056]">
                  <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                  <SummaryRow
                    label="Shipping"
                    value={shippingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(shippingFee)}
                  />
                  <SummaryRow
                    label="Packaging"
                    value={packagingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(packagingFee)}
                  />
                  {savings > 0 ? <SummaryRow label="Product savings" value={`-${formatCurrency(savings)}`} /> : null}
                </div>

                <div className="mt-5 border-t border-[#e3d8c9] pt-5">
                  <div className="flex items-center justify-between text-lg font-semibold text-[#2b2a29]">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#7a7f72]">
                    Taxes can stay inclusive in the product price unless you decide to show GST separately later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSummaryButtonClick}
                  disabled={items.length === 0 || (activeScreen === "address" && !canProceedToPayment)}
                  className="brand-caption mt-6 inline-flex w-full items-center justify-center rounded-[1.1rem] bg-[#5e684f] px-5 py-4 text-[0.68rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {items.length === 0
                    ? "ADD ITEMS TO CONTINUE"
                    : activeScreen === "bag"
                      ? "ADD ADDRESS AND CONTINUE"
                      : "PROCEED TO PAY"}
                </button>

                {paymentMessage ? (
                  <p className="mt-4 rounded-[1rem] border border-[#d8cbb7] bg-[#fbf7ef] px-4 py-3 text-sm leading-6 text-[#667056]">
                    {paymentMessage}
                  </p>
                ) : null}
              </section>
            </aside>
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" featuredHref="/shop/featured/" contactId="contact" />
    </main>
  );
}

function QuantityButton({
  label,
  children,
  onClick
}: {
  label: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eadb] text-xl text-[#4f5942]"
    >
      {children}
    </button>
  );
}

function CheckoutInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[52px] w-full rounded-[1rem] border border-[#d6ccb9] bg-[#fbf7ef] px-4 text-sm text-[#2b2a29] outline-none transition-colors duration-200 focus:border-[#5e684f]"
      />
    </label>
  );
}

function CheckoutTextarea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-[1rem] border border-[#d6ccb9] bg-[#fbf7ef] px-4 py-3 text-sm text-[#2b2a29] outline-none transition-colors duration-200 focus:border-[#5e684f]"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[#2b2a29]">{value}</span>
    </div>
  );
}
