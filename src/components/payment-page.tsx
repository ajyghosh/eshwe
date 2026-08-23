"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { formatCurrency } from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import {
  getRazorpayApiUrl,
  loadRazorpayCheckoutScript,
  type RazorpayCheckoutOptions,
  type RazorpayEventResponse,
  type RazorpayHandlerResponse
} from "@/lib/razorpay";
import type { CustomerAddress } from "@/types/customer-profile";

type PaymentFormState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

type AddressDialogFormState = PaymentFormState & {
  label: string;
};

type CreateOrderResponse = {
  amount: number;
  currency: string;
  internalOrderId: string;
  keyId: string;
  lineItems: Array<{
    name: string;
    quantity: string | number;
    sku: string;
  }>;
  razorpayOrderId: string;
};

const emptyGuestForm: PaymentFormState = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: ""
};

const emptyAddressDialogForm: AddressDialogFormState = {
  label: "",
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: ""
};

export function PaymentPage() {
  const { items, subtotal, savings, shippingFee, packagingFee, total, clearCart } = useCart();
  const { user } = useAuthSession();
  const router = useRouter();
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [guestForm, setGuestForm] = useState<PaymentFormState>(emptyGuestForm);
  const [orderNotes, setOrderNotes] = useState("");
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressDialogForm, setAddressDialogForm] = useState<AddressDialogFormState>(emptyAddressDialogForm);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const guestCanProceed =
    items.length > 0 &&
    Boolean(
      guestForm.fullName.trim() &&
        guestForm.email.trim() &&
        guestForm.phone.trim() &&
        guestForm.address.trim() &&
        guestForm.city.trim() &&
        guestForm.state.trim() &&
        guestForm.pincode.trim()
    );
  const canProceedToPayment = items.length > 0 && (user ? Boolean(selectedAddress) : guestCanProceed);

  useEffect(() => {
    setGuestForm((currentForm) => ({
      ...currentForm,
      fullName: currentForm.fullName || user?.displayName || "",
      email: currentForm.email || user?.email || ""
    }));
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    if (!user?.uid) {
      setSavedAddresses([]);
      setSelectedAddressId("");
      setProfileLoading(false);
      return;
    }

    const activeUserId = user.uid;
    const userDisplayName = user.displayName ?? "";
    const userEmail = user.email ?? "";
    let isMounted = true;

    async function loadCustomerProfile() {
      setProfileLoading(true);
      setProfileError(null);

      try {
        const customerProfile = await getCustomerProfile(activeUserId);

        if (!isMounted) {
          return;
        }

        const nextSavedAddresses = customerProfile?.addresses ?? [];
        const nextSelectedAddressId = customerProfile?.selectedAddressId ?? nextSavedAddresses[0]?.id ?? "";

        setSavedAddresses(nextSavedAddresses);
        setSelectedAddressId(nextSelectedAddressId);
        setAddressDialogForm((currentForm) => ({
          ...currentForm,
          fullName: currentForm.fullName || userDisplayName,
          email: currentForm.email || userEmail
        }));

      } catch (error) {
        if (isMounted) {
          setProfileError(error instanceof Error ? error.message : "Failed to load saved addresses.");
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

  useEffect(() => {
    if (items.length === 0) {
      router.replace("/checkout");
    }
  }, [items.length, router]);

  function handleGuestFieldChange(field: keyof PaymentFormState, value: string) {
    setGuestForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleAddressDialogFieldChange(field: keyof AddressDialogFormState, value: string) {
    setAddressDialogForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleOpenAddressDialog() {
    setProfileError(null);
    setEditingAddressId("");
    setAddressDialogForm({
      label: "",
      fullName: user?.displayName || selectedAddress?.fullName || "",
      email: user?.email || selectedAddress?.email || "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: ""
    });
    setAddressDialogOpen(true);
  }

  function handleEditSavedAddress(address: CustomerAddress) {
    setProfileError(null);
    setEditingAddressId(address.id);
    setAddressDialogForm({
      label: address.label,
      fullName: address.fullName,
      email: address.email,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state,
      pincode: address.pincode
    });
    setAddressDialogOpen(true);
  }

  function handleSelectSavedAddress(addressId: string) {
    setSelectedAddressId(addressId);
    setProfileError(null);
  }

  async function handleSaveAddress() {
    if (!user?.uid) {
      setProfileError("Sign in before saving an address.");
      return;
    }

    const nextAddress = buildCustomerAddress(addressDialogForm, savedAddresses.length, editingAddressId);

    if (!nextAddress) {
      setProfileError("Complete all address details before saving.");
      return;
    }

    setProfileSaving(true);
    setProfileError(null);

    try {
      const nextSavedAddresses = editingAddressId
        ? savedAddresses.map((address) => (address.id === editingAddressId ? nextAddress : address))
        : [...savedAddresses, nextAddress];
      await saveCustomerProfile(user.uid, buildProfilePayload(nextSavedAddresses, nextAddress.id));
      setSavedAddresses(nextSavedAddresses);
      setSelectedAddressId(nextAddress.id);
      setAddressDialogOpen(false);
      setEditingAddressId("");
      setProfileMessage(
        editingAddressId ? "Address updated. You can continue with it now." : "Address saved. You can continue with it now."
      );
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : editingAddressId ? "Failed to update address." : "Failed to save address.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleProceedToPayment() {
    const deliveryAddress = user ? selectedAddress : buildGuestDeliveryAddress(guestForm);

    if (!deliveryAddress) {
      setProfileError(
        user ? "Select a saved address or add a new address before continuing." : "Complete the address form first."
      );
      return;
    }

    setProfileError(null);
    await startRazorpayCheckout(deliveryAddress);
  }

  async function startRazorpayCheckout(deliveryAddress: PaymentFormState) {
    if (items.length === 0) {
      setProfileError("Your cart is empty.");
      return;
    }

    setPaymentSubmitting(true);
    setPaymentMessage("Preparing secure Razorpay checkout...");
    setProfileError(null);

    try {
      const order = await createOrder(deliveryAddress);
      await loadRazorpayCheckoutScript();
      let checkoutFinished = false;

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable right now.");
      }

      const checkoutOptions: RazorpayCheckoutOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Eshwe Saree Studio",
        description: `Secure checkout for ${order.lineItems.length} item${order.lineItems.length === 1 ? "" : "s"}`,
        image: "/favicon-32x32.png",
        order_id: order.razorpayOrderId,
        prefill: {
          name: deliveryAddress.fullName,
          email: deliveryAddress.email,
          contact: deliveryAddress.phone
        },
        notes: {
          internalOrderId: order.internalOrderId,
          customerPhone: deliveryAddress.phone
        },
        theme: {
          color: "#5e684f"
        },
        modal: {
          ondismiss: () => {
            if (checkoutFinished) {
              return;
            }

            setPaymentSubmitting(false);
            setPaymentMessage(null);
          }
        },
        handler: async (paymentResponse) => {
          checkoutFinished = true;
          setPaymentSubmitting(true);
          setPaymentMessage("Verifying payment...");

          try {
            await verifyPayment(order.internalOrderId, paymentResponse);
            clearCart();
            setPaymentMessage("Payment successful. Your order has been confirmed.");
          } catch (error) {
            setPaymentMessage(error instanceof Error ? error.message : "Payment verification failed.");
          } finally {
            setPaymentSubmitting(false);
          }
        }
      };

      const razorpay = new window.Razorpay(checkoutOptions);
      razorpay.on("payment.failed", (response: RazorpayEventResponse) => {
        checkoutFinished = true;
        setPaymentSubmitting(false);
        setPaymentMessage(getPaymentFailureMessage(response));
      });

      razorpay.open();
      setPaymentSubmitting(false);
      setPaymentMessage(null);
    } catch (error) {
      setPaymentSubmitting(false);
      setPaymentMessage(null);
      setProfileError(error instanceof Error ? error.message : "Unable to start payment.");
    }
  }

  async function createOrder(deliveryAddress: PaymentFormState): Promise<CreateOrderResponse> {
    let response: Response;

    try {
      response = await fetch(getRazorpayApiUrl("create-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity
          })),
          customer: deliveryAddress,
          notes: orderNotes.trim(),
          sourcePath: window.location.pathname,
          userId: user?.uid ?? null
        })
      });
    } catch {
      throw new Error("Unable to reach the payment server. Check your connection and try again.");
    }

    const result = (await response.json().catch(() => ({}))) as Partial<CreateOrderResponse> & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Unable to create payment order.");
    }

    if (
      !result ||
      typeof result.keyId !== "string" ||
      typeof result.razorpayOrderId !== "string" ||
      typeof result.internalOrderId !== "string" ||
      typeof result.amount !== "number" ||
      typeof result.currency !== "string" ||
      !Array.isArray(result.lineItems)
    ) {
      throw new Error("Payment order response is invalid.");
    }

    return result as CreateOrderResponse;
  }

  async function verifyPayment(internalOrderId: string, paymentResponse: RazorpayHandlerResponse) {
    const response = await fetch(getRazorpayApiUrl("verify-payment"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        internalOrderId,
        ...paymentResponse
      })
    });

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Payment verification failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">PAYMENT</p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              Address, sign in, and payment.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              If you have already registered, sign in to use saved addresses. Otherwise, add your delivery address and continue to payment.
            </p>
          </div>

          {items.length === 0 ? (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-center shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
              <p className="brand-copy text-2xl text-[#2b2a29]">Returning to your bag...</p>
            </section>
          ) : (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
              <section className="space-y-6 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                {!user ? (
                  <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">RETURNING USER</p>
                    <p className="mt-2 text-sm leading-6 text-[#667056]">
                      Sign in from the top bar to load saved addresses. If you want to continue without signing in, add your address below and proceed to payment.
                    </p>
                  </div>
                ) : null}

                {profileMessage ? <p className="text-sm text-[#5e684f]">{profileMessage}</p> : null}
                {profileError ? <p className="text-sm text-[#9d4b45]">{profileError}</p> : null}

                {user ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">CURRENT ADDRESS</p>
                          {selectedAddress ? (
                            <button
                              type="button"
                              onClick={() => handleEditSavedAddress(selectedAddress)}
                              className="rounded-full border border-[#d6ccb9] bg-[#fffaf2] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-[#4f5942]"
                            >
                              Edit Address
                            </button>
                          ) : null}
                        </div>
                        {selectedAddress ? (
                          <div className="mt-4 space-y-2">
                            <p className="text-base font-semibold text-[#2b2a29]">
                              {selectedAddress.label || "Saved Address"}
                            </p>
                            <p className="text-sm leading-6 text-[#667056]">
                              {selectedAddress.fullName}
                              <br />
                              {selectedAddress.address}, {selectedAddress.city}, {selectedAddress.state} -{" "}
                              {selectedAddress.pincode}
                            </p>
                            <p className="text-sm leading-6 text-[#667056]">
                              {selectedAddress.phone} · {selectedAddress.email}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm leading-6 text-[#667056]">
                            No saved address yet. Add one to continue.
                          </p>
                        )}
                      </div>

                      <div className="rounded-[1.5rem] border border-dashed border-[#cdbda8] bg-[#fffaf2] p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">ADD ADDRESS</p>
                        <p className="mt-4 text-sm leading-6 text-[#667056]">
                          Add a new address in a popup, save it to your account, and use it for this order.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenAddressDialog}
                          className="mt-5 rounded-full bg-[#5e684f] px-5 py-3 text-sm font-semibold text-[#fbf4e8]"
                        >
                          Add Address
                        </button>
                      </div>
                    </div>

                    {savedAddresses.length > 0 ? (
                      <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">SELECT SAVED ADDRESS</p>
                        <div className="mt-4 grid gap-3">
                          {savedAddresses.map((address) => {
                            const isSelected = address.id === selectedAddressId;

                            return (
                              <div
                                key={address.id}
                                className={`rounded-[1.3rem] border px-4 py-4 text-left transition-colors ${
                                  isSelected
                                    ? "border-[#5e684f] bg-[#f1e8d8]"
                                    : "border-[#ddd1c0] bg-[#fffaf2] hover:border-[#cdbda8]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-[#2b2a29]">{address.label}</p>
                                    <p className="mt-1 text-sm leading-6 text-[#667056]">
                                      {address.fullName}
                                      <br />
                                      {address.address}, {address.city}, {address.state} - {address.pincode}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectSavedAddress(address.id)}
                                      className="rounded-full border border-[#d6ccb9] bg-[#fffaf2] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-[#4f5942]"
                                    >
                                      {isSelected ? "Selected" : "Use This"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">ORDER NOTES</p>
                      <div className="mt-4">
                        <PaymentTextarea
                          label="Order notes"
                          value={orderNotes}
                          onChange={setOrderNotes}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">ADD ADDRESS</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <PaymentInput
                        label="Full name"
                        value={guestForm.fullName}
                        onChange={(value) => handleGuestFieldChange("fullName", value)}
                      />
                      <PaymentInput
                        label="Email"
                        type="email"
                        value={guestForm.email}
                        onChange={(value) => handleGuestFieldChange("email", value)}
                      />
                      <PaymentInput
                        label="Phone"
                        type="tel"
                        value={guestForm.phone}
                        onChange={(value) => handleGuestFieldChange("phone", value)}
                      />
                      <PaymentInput
                        label="Pincode"
                        value={guestForm.pincode}
                        onChange={(value) => handleGuestFieldChange("pincode", value)}
                      />
                      <div className="sm:col-span-2">
                        <PaymentInput
                          label="Address"
                          value={guestForm.address}
                          onChange={(value) => handleGuestFieldChange("address", value)}
                        />
                      </div>
                      <PaymentInput
                        label="City"
                        value={guestForm.city}
                        onChange={(value) => handleGuestFieldChange("city", value)}
                      />
                      <PaymentInput
                        label="State"
                        value={guestForm.state}
                        onChange={(value) => handleGuestFieldChange("state", value)}
                      />
                      <div className="sm:col-span-2">
                        <PaymentTextarea
                          label="Order notes"
                          value={orderNotes}
                          onChange={setOrderNotes}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section className="rounded-[2rem] border border-[#d9cebe] bg-[#fffaf2] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.1)] sm:p-7">
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                    ORDER SUMMARY
                  </p>

                  <div className="mt-5 space-y-3">
                    {items.map((item) => (
                      <div key={item.sku} className="flex items-start justify-between gap-4 text-sm text-[#667056]">
                        <div>
                          <p className="font-medium text-[#2b2a29]">{item.name}</p>
                          <p className="mt-1">
                            {item.quantity} item{item.quantity === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="font-medium text-[#2b2a29]">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-4 border-t border-[#e3d8c9] pt-5 text-sm text-[#667056]">
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
                      {user
                        ? "Select a saved address or add one, then continue to Razorpay."
                        : "Fill in the address form, then continue to Razorpay."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleProceedToPayment()}
                    disabled={!canProceedToPayment || paymentSubmitting || profileSaving || profileLoading}
                    className="brand-caption mt-6 inline-flex w-full items-center justify-center rounded-[1.1rem] bg-[#5e684f] px-5 py-4 text-[0.68rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentSubmitting || profileSaving ? "PROCESSING" : "PROCEED TO PAYMENT"}
                  </button>

                  {paymentMessage ? (
                    <p className="mt-4 rounded-[1rem] border border-[#d8cbb7] bg-[#fbf7ef] px-4 py-3 text-sm leading-6 text-[#667056]">
                      {paymentMessage}
                    </p>
                  ) : null}
                </section>
              </aside>
            </div>
          )}
        </div>
      </section>

      <AddressDialog
        open={addressDialogOpen}
        form={addressDialogForm}
        editing={Boolean(editingAddressId)}
        pending={profileSaving}
        onClose={() => {
          setAddressDialogOpen(false);
          setEditingAddressId("");
        }}
        onFieldChange={handleAddressDialogFieldChange}
        onSave={() => void handleSaveAddress()}
      />

      <SiteFooter homeHref="/" featuredHref="/shop/featured/" contactId="contact" />
    </main>
  );
}

function PaymentInput({
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

function PaymentTextarea({
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

function AddressDialog({
  open,
  form,
  editing,
  pending,
  onClose,
  onFieldChange,
  onSave
}: {
  open: boolean;
  form: AddressDialogFormState;
  editing: boolean;
  pending: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof AddressDialogFormState, value: string) => void;
  onSave: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#3f4738]/38 px-4 py-6 sm:px-6">
      <div className="w-full max-w-2xl rounded-[1.7rem] border border-[#e1d5c5] bg-[#fbf4e8] p-6 shadow-[0_28px_70px_rgba(63,71,56,0.2)] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">
              {editing ? "EDIT ADDRESS" : "ADD ADDRESS"}
            </p>
            <h3 className="brand-copy mt-2 text-2xl text-[#3f4738]">
              {editing ? "Update saved address" : "Save a new address"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border border-[#d1c3ae] px-4 py-2 text-sm font-semibold text-[#5e684f] disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PaymentInput
            label="Address label"
            value={form.label}
            onChange={(value) => onFieldChange("label", value)}
          />
          <PaymentInput
            label="Full name"
            value={form.fullName}
            onChange={(value) => onFieldChange("fullName", value)}
          />
          <PaymentInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => onFieldChange("email", value)}
          />
          <PaymentInput
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(value) => onFieldChange("phone", value)}
          />
          <PaymentInput
            label="Pincode"
            value={form.pincode}
            onChange={(value) => onFieldChange("pincode", value)}
          />
          <PaymentInput
            label="City"
            value={form.city}
            onChange={(value) => onFieldChange("city", value)}
          />
          <PaymentInput
            label="State"
            value={form.state}
            onChange={(value) => onFieldChange("state", value)}
          />
          <div className="sm:col-span-2">
            <PaymentInput
              label="Address"
              value={form.address}
              onChange={(value) => onFieldChange("address", value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-full bg-[#5e684f] px-5 py-3 text-sm font-semibold text-[#fbf4e8] disabled:opacity-60"
          >
            {pending ? (editing ? "Updating" : "Saving") : editing ? "Update Address" : "Save Address"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border border-[#d1c3ae] px-5 py-3 text-sm font-semibold text-[#5e684f] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function buildGuestDeliveryAddress(form: PaymentFormState) {
  if (
    !form.fullName.trim() ||
    !form.email.trim() ||
    !form.phone.trim() ||
    !form.address.trim() ||
    !form.city.trim() ||
    !form.state.trim() ||
    !form.pincode.trim()
  ) {
    return null;
  }

  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim()
  };
}

function buildCustomerAddress(form: AddressDialogFormState, existingAddressCount: number, addressId?: string) {
  const deliveryAddress = buildGuestDeliveryAddress(form);

  if (!deliveryAddress) {
    return null;
  }

  return {
    id: addressId || `address-${Date.now()}`,
    label: form.label.trim() || `Address ${existingAddressCount + 1}`,
    ...deliveryAddress
  } satisfies CustomerAddress;
}

function buildProfilePayload(addresses: CustomerAddress[], selectedAddressId: string) {
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? addresses[0];

  if (!selectedAddress) {
    throw new Error("No address selected.");
  }

  return {
    fullName: selectedAddress.fullName,
    email: selectedAddress.email,
    phone: selectedAddress.phone,
    address: selectedAddress.address,
    city: selectedAddress.city,
    state: selectedAddress.state,
    pincode: selectedAddress.pincode,
    selectedAddressId,
    addresses
  };
}

function getPaymentFailureMessage(response: RazorpayEventResponse) {
  const reason = response.error?.description || response.error?.reason;
  return reason ? `Payment failed: ${reason}` : "Payment failed. Please try again.";
}
