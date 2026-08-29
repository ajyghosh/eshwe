"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { formatCurrency } from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { CheckoutProgress } from "@/components/checkout-progress";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import { isCartItemUnavailable } from "@/lib/inventory";
import { saveLatestOrderConfirmation, type OrderConfirmationData } from "@/lib/order-confirmation";
import { buildProtectedJsonHeadersForPath } from "@/lib/protected-request";
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
    color?: string;
    name: string;
    primaryImageUrl?: string;
    quantity: number;
    sku: string;
    unitOriginalPrice?: number | null;
    unitPrice?: number | null;
  }>;
  razorpayOrderId: string;
};

type PaymentOverlayStep = "verifying" | null;

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
  const { items, isReady, subtotal, savings, shippingFee, packagingFee, total, clearCart } = useCart();
  const { user, signIn } = useAuthSession();
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
  const [paymentOverlayStep, setPaymentOverlayStep] = useState<PaymentOverlayStep>(null);
  const orderConfirmationRedirectRef = useRef(false);
  const checkoutProgressStep = paymentSubmitting || paymentOverlayStep ? "pay" : "address";

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
  const hasUnavailableItems = items.some((item) => isCartItemUnavailable(item));
  const canProceedToPayment = items.length > 0 && !hasUnavailableItems && (user ? Boolean(selectedAddress) : guestCanProceed);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const subtotalLabel = `Subtotal${itemCount > 0 ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}`;

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
    if (!isReady) {
      return;
    }

    if (items.length === 0 && !orderConfirmationRedirectRef.current) {
      router.replace("/checkout");
    }
  }, [isReady, items.length, router]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    void loadRazorpayCheckoutScript().catch((error) => {
      console.warn(error instanceof Error ? error.message : "Failed to preload Razorpay checkout.");
    });
  }, [items.length]);

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

  async function handleSignIn() {
    try {
      await signIn();
    } catch {
      setProfileError("Sign in failed.");
    }
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
    if (hasUnavailableItems) {
      setProfileError("One or more sarees in your bag are no longer available. Remove them from the cart before paying.");
      return;
    }

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
    setPaymentMessage("Redirecting to secure payment");
    setProfileError(null);

    try {
      const order = await createOrder(deliveryAddress);

      if (!window.Razorpay) {
        await loadRazorpayCheckoutScript();
      }

      let checkoutFinished = false;

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable right now.");
      }

      const checkoutOptions: RazorpayCheckoutOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        description: `Secure checkout for ${order.lineItems.length} item${order.lineItems.length === 1 ? "" : "s"}`,
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
        modal: {
          ondismiss: () => {
            if (checkoutFinished) {
              return;
            }

            setPaymentOverlayStep(null);
            setPaymentSubmitting(false);
            setPaymentMessage(null);
          }
        },
        handler: async (paymentResponse) => {
          checkoutFinished = true;
          setPaymentSubmitting(true);
          setPaymentOverlayStep("verifying");
          setPaymentMessage("Preparing your receipt...");

          try {
            await verifyPayment(order.internalOrderId, paymentResponse);
            const confirmation = buildOrderConfirmation(order, deliveryAddress, paymentResponse);

            orderConfirmationRedirectRef.current = true;
            saveLatestOrderConfirmation(confirmation);
            clearCart();
            router.replace("/order-confirmation");
          } catch (error) {
            setPaymentOverlayStep(null);
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
      setPaymentOverlayStep(null);
      setPaymentSubmitting(false);
      setPaymentMessage(null);
      setProfileError(error instanceof Error ? error.message : "Unable to start payment.");
    }
  }

  async function createOrder(deliveryAddress: PaymentFormState): Promise<CreateOrderResponse> {
    let response: Response;
    const requestUrl = getRazorpayApiUrl("create-order");
    const headers = await buildProtectedJsonHeadersForPath(requestUrl);

    try {
      response = await fetch(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity
          })),
          customer: deliveryAddress,
          notes: orderNotes.trim(),
          sourcePath: window.location.pathname
        })
      });
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unable to reach the payment server. Check your connection and try again."
      );
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
    const requestUrl = getRazorpayApiUrl("verify-payment");
    const headers = await buildProtectedJsonHeadersForPath(requestUrl);
    const response = await fetch(requestUrl, {
      method: "POST",
      headers,
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

  function buildOrderConfirmation(
    order: CreateOrderResponse,
    deliveryAddress: PaymentFormState,
    paymentResponse: RazorpayHandlerResponse
  ): OrderConfirmationData {
    return {
      createdAtIso: new Date().toISOString(),
      customer: {
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        email: deliveryAddress.email,
        fullName: deliveryAddress.fullName,
        phone: deliveryAddress.phone,
        pincode: deliveryAddress.pincode,
        state: deliveryAddress.state
      },
      internalOrderId: order.internalOrderId,
      items: order.lineItems.map((item) => ({
        color: item.color,
        name: item.name,
        primaryImageUrl: item.primaryImageUrl,
        quantity: item.quantity,
        sku: item.sku,
        unitOriginalPrice: item.unitOriginalPrice,
        unitPrice: item.unitPrice
      })),
      notes: orderNotes.trim(),
      paymentStatus: "captured",
      razorpayOrderId: paymentResponse.razorpay_order_id,
      razorpayPaymentId: paymentResponse.razorpay_payment_id,
      summary: {
        currency: order.currency,
        packagingFee,
        savings,
        shippingFee,
        subtotal,
        total
      }
    };
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      {paymentOverlayStep ? (
        <ReceiptPreparingOverlay
          customerName={(user ? selectedAddress?.fullName ?? "" : guestForm.fullName).trim() || "there"}
          itemCount={itemCount}
        />
      ) : null}

      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <CheckoutProgress currentStep={checkoutProgressStep} />
          <div className="mb-8">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">PAYMENT</p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              Delivery address and secure checkout.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              Keep this step focused: sign in if you already have an account, otherwise add the address for this order and continue to Razorpay.
            </p>
          </div>

          {items.length === 0 ? (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-center shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
              <p className="brand-copy text-2xl text-[#2b2a29]">Getting your checkout ready...</p>
            </section>
          ) : (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
              <section className="space-y-6 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                {profileMessage ? <p className="text-sm text-[#5e684f]">{profileMessage}</p> : null}
                {profileError ? <p className="text-sm text-[#9d4b45]">{profileError}</p> : null}
                {hasUnavailableItems ? (
                  <p className="text-sm text-[#9d4b45]">
                    One or more sarees in your bag are no longer available. Return to checkout and remove them before paying.
                  </p>
                ) : null}
                {hasUnavailableItems ? (
                  <Link
                    href="/checkout"
                    className="inline-flex w-fit text-sm font-medium text-[#5e684f] underline decoration-1 underline-offset-4"
                  >
                    Go back to checkout
                  </Link>
                ) : null}

                {user ? (
                  <>
                    <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">DELIVERY ADDRESS</p>
                          <p className="mt-2 text-sm text-[#667056]">
                            Use the saved address for this order or update it here.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedAddress ? (
                            <button
                              type="button"
                              onClick={() => handleEditSavedAddress(selectedAddress)}
                              className="rounded-full border border-[#d6ccb9] bg-[#fffaf2] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-[#4f5942]"
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={handleOpenAddressDialog}
                            className="rounded-full border border-[#d6ccb9] bg-[#fffaf2] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-[#4f5942]"
                          >
                            {selectedAddress ? "Replace" : "Add address"}
                          </button>
                        </div>
                      </div>
                      {selectedAddress ? (
                        <div className="mt-4 rounded-[1.2rem] border border-[#e6dccf] bg-white/70 px-4 py-4">
                          <p className="text-base font-semibold text-[#2b2a29]">{selectedAddress.fullName}</p>
                          <p className="mt-1 text-sm leading-6 text-[#667056]">
                            {selectedAddress.address}, {selectedAddress.city}, {selectedAddress.state} -{" "}
                            {selectedAddress.pincode}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#667056]">
                            {selectedAddress.phone} · {selectedAddress.email}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm leading-6 text-[#667056]">
                          No saved address available for this account.
                        </p>
                      )}
                    </div>

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
                  <div className="space-y-5">
                    <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fffaf2] p-5">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">SIGN IN</p>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-[#667056]">
                        Existing customer? Sign in to use your saved address and checkout faster.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleSignIn()}
                        className="brand-caption mt-5 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                      >
                        SIGN IN WITH GOOGLE
                      </button>
                    </div>

                    <div className="rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-5">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[#7d876f]">DELIVERY ADDRESS</p>
                      <p className="mt-3 text-sm leading-6 text-[#667056]">
                        Add the address for this order and continue to payment.
                      </p>
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
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section className="rounded-[2rem] border border-[#dfd4c5] bg-[#fffdf8] p-5 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-6">
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#2b2a29]">
                    RAZORPAY CHECKOUT
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#667056]">
                    Review the order here, then continue to the secure Razorpay payment window.
                  </p>

                  <div className="mt-5 space-y-4">
                    {items.map((item) => (
                      <div key={item.sku} className="flex items-start justify-between gap-4 text-sm text-[#5f6259]">
                        <div>
                          <p className="font-medium text-[#2b2a29]">{item.name}</p>
                          <p className="mt-1">
                            {item.quantity} item{item.quantity === 1 ? "" : "s"}
                          </p>
                          {isCartItemUnavailable(item) ? (
                            <p className="mt-1 text-[#9d4b45]">No longer available</p>
                          ) : null}
                        </div>
                        <span className="font-medium text-[#2b2a29]">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-4 border-t border-[#e9dfd1] pt-5 text-sm text-[#5f6259]">
                    <SummaryRow label={subtotalLabel} value={formatCurrency(subtotal)} />
                    <SummaryRow
                      label="Shipping"
                      value={shippingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(shippingFee)}
                      valueClassName={shippingFee === 0 && subtotal > 0 ? "text-[#5e684f]" : undefined}
                    />
                    <SummaryRow
                      label="Packaging"
                      value={packagingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(packagingFee)}
                      valueClassName={packagingFee === 0 && subtotal > 0 ? "text-[#5e684f]" : undefined}
                    />
                    {savings > 0 ? (
                      <SummaryRow
                        label="Product savings"
                        value={`-${formatCurrency(savings)}`}
                        valueClassName="text-[#b85b52]"
                      />
                    ) : null}
                  </div>

                  <div className="mt-6 border-t border-[#e9dfd1] pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="brand-copy text-[1.7rem] leading-none text-[#2b2a29]">Total</span>
                      <span className="text-[1.8rem] font-semibold leading-none text-[#2b2a29]">{formatCurrency(total)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#9a9a93]">
                      {user
                        ? "Your address is ready. Continue to Razorpay."
                        : "Add your address to continue to Razorpay."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleProceedToPayment()}
                    disabled={!canProceedToPayment || paymentSubmitting || profileSaving || profileLoading}
                    className="brand-caption mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-[1rem] bg-[#5e684f] px-5 py-3.5 text-[0.68rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden="true" className="inline-flex">
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8]">
                        <path d="M6.5 8V6.5a3.5 3.5 0 1 1 7 0V8" />
                        <rect x="4.5" y="8" width="11" height="8.5" rx="2" />
                      </svg>
                    </span>
                    {paymentSubmitting
                      ? paymentMessage === "Redirecting to secure payment"
                        ? "REDIRECTING TO RAZORPAY"
                        : "PROCESSING"
                      : profileSaving
                        ? "PROCESSING"
                      : hasUnavailableItems
                        ? "UNAVAILABLE ITEMS IN BAG"
                          : "CONTINUE TO RAZORPAY"}
                  </button>

                  {paymentMessage && !paymentOverlayStep ? (
                    <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-[#d8cbb7] bg-[#fbf7ef] px-4 py-3 text-sm leading-6 text-[#667056]">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6ccb9] border-t-[#5e684f]"
                      />
                      <p>{paymentMessage}</p>
                    </div>
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

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}

function ReceiptPreparingOverlay({
  customerName,
  itemCount
}: {
  customerName: string;
  itemCount: number;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(251,244,232,0.82)] px-6 backdrop-blur-[10px]">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2.4rem] border border-[#ddd0bc] bg-[linear-gradient(180deg,rgba(255,250,242,0.98)_0%,rgba(247,237,224,0.96)_100%)] px-7 py-8 shadow-[0_30px_100px_rgba(94,104,79,0.18)] sm:px-10 sm:py-10">
        <div aria-hidden className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#cfb47d] to-transparent" />

        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-[#dcc9ad] bg-[linear-gradient(135deg,#fff3df_0%,#efd8ab_100%)] shadow-[0_18px_40px_rgba(176,111,61,0.16)]">
            <Image
              src="/eshwelogo.png"
              alt="Eshwe"
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>

          <p className="brand-caption mt-5 text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
            PAYMENT RECEIVED
          </p>
          <h2 className="brand-copy mt-4 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
            Preparing your receipt.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
            Payment confirmed for {customerName}. We are verifying {itemCount} item{itemCount === 1 ? "" : "s"} and
            opening the order confirmation now.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <div className="relative rounded-[1.8rem] border border-[#d7ccb9] bg-[#667056] px-6 pb-6 pt-5 shadow-[0_22px_45px_rgba(94,104,79,0.2)]">
            <div className="mx-auto h-2 w-28 rounded-full bg-[rgba(255,250,242,0.26)]" />
            <div className="absolute left-1/2 top-[3.2rem] h-3 w-44 -translate-x-1/2 rounded-full bg-[rgba(35,42,28,0.18)] blur-md" />

            <div className="receipt-printer-card absolute left-1/2 top-[3.2rem] w-[78%] -translate-x-1/2 overflow-hidden rounded-b-[1.3rem] rounded-t-[0.8rem] border border-[#eadfce] bg-[#fffaf2] shadow-[0_18px_34px_rgba(47,40,32,0.16)]">
              <div className="receipt-shine h-2 w-full bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0)_100%)]" />
              <div className="space-y-3 px-5 pb-5 pt-4">
                <div className="flex items-center justify-between">
                  <span className="h-2.5 w-20 rounded-full bg-[#d8cbb7]" />
                  <span className="h-2.5 w-14 rounded-full bg-[#ece3d6]" />
                </div>
                <div className="h-px w-full bg-[#ece1d3]" />
                <div className="space-y-2">
                  <span className="block h-2.5 w-full rounded-full bg-[#e6dbc9]" />
                  <span className="block h-2.5 w-[82%] rounded-full bg-[#e6dbc9]" />
                  <span className="block h-2.5 w-[65%] rounded-full bg-[#efe6d9]" />
                </div>
                <div className="h-px w-full bg-[#ece1d3]" />
                <div className="flex items-center justify-between">
                  <span className="h-2.5 w-16 rounded-full bg-[#e6dbc9]" />
                  <span className="h-3 w-20 rounded-full bg-[#d2dec9]" />
                </div>
              </div>
            </div>

            <div className="pt-48">
              <div className="grid grid-cols-3 gap-3">
                <StatusPill label="Payment" value="Captured" />
                <StatusPill label="Receipt" value="Printing" />
                <StatusPill label="Next" value="Preview" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f]" />
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f] [animation-delay:180ms]" />
            <span className="receipt-progress-dot h-2.5 w-2.5 rounded-full bg-[#5e684f] [animation-delay:360ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[rgba(255,250,242,0.14)] bg-[rgba(255,250,242,0.1)] px-3 py-3 text-center">
      <p className="text-[0.58rem] font-semibold tracking-[0.14em] text-[rgba(255,250,242,0.72)]">{label}</p>
      <p className="mt-1 text-xs font-medium text-[#fffaf2]">{value}</p>
    </div>
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

function SummaryRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className={`font-medium text-[#2b2a29] ${valueClassName ?? ""}`}>{value}</span>
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
