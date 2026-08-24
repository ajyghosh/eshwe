"use client";

import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import { subscribeToCustomerOrders } from "@/lib/orders";
import type { CustomerAddress } from "@/types/customer-profile";
import type { CheckoutOrder } from "@/types/order";

type AddressDialogFormState = {
  label: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
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

export function AccountPage() {
  const { user, loading, signIn } = useAuthSession();
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressDialogForm, setAddressDialogForm] = useState<AddressDialogFormState>(emptyAddressDialogForm);

  useEffect(() => {
    if (!user?.uid) {
      setSavedAddresses([]);
      setSelectedAddressId("");
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    let isMounted = true;
    const activeUserId = user.uid;
    setProfileLoading(true);
    setProfileError(null);

    async function loadProfile() {
      try {
        const customerProfile = await getCustomerProfile(activeUserId);

        if (!isMounted) {
          return;
        }

        const nextSavedAddresses = customerProfile?.addresses ?? [];
        const nextSelectedAddressId = customerProfile?.selectedAddressId ?? nextSavedAddresses[0]?.id ?? "";

        setSavedAddresses(nextSavedAddresses);
        setSelectedAddressId(nextSelectedAddressId);
      } catch (error) {
        if (isMounted) {
          setSavedAddresses([]);
          setSelectedAddressId("");
          setProfileError(error instanceof Error ? error.message : "Failed to load saved addresses.");
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError(null);
      return;
    }

    const activeUserId = user.uid;
    setOrdersLoading(true);
    setOrdersError(null);

    return subscribeToCustomerOrders(
      activeUserId,
      (nextOrders) => {
        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      (error) => {
        setOrders([]);
        setOrdersLoading(false);
        setOrdersError(error.message);
      }
    );
  }, [user?.uid]);

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

  async function handleSignIn() {
    try {
      await signIn();
    } catch {
      setProfileError("Sign in failed.");
    }
  }

  function handleViewOrderDetails(order: CheckoutOrder) {
    if (typeof window === "undefined") {
      return;
    }

    const printWindow = window.open("", "_blank", "width=920,height=980");

    if (!printWindow) {
      setOrdersError("Enable pop-ups to open the order slip.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildOrderSlipHtml(order, window.location.origin));
    printWindow.document.close();
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
      fullName: user?.displayName || "",
      email: user?.email || "",
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
      const nextSelectedAddressId = selectedAddressId || nextSavedAddresses[0]?.id || nextAddress.id;

      await saveCustomerProfile(user.uid, buildProfilePayload(nextSavedAddresses, nextSelectedAddressId));
      setSavedAddresses(nextSavedAddresses);
      setSelectedAddressId(nextSelectedAddressId);
      setAddressDialogOpen(false);
      setEditingAddressId("");
      setProfileMessage(
        editingAddressId ? "Address updated in your profile." : "Address added to your profile."
      );
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save address.");
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
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">ACCOUNT</p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              Your profile, addresses, and orders.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              Review saved addresses and your recent orders in one place.
            </p>
          </div>

          {loading ? (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056] shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
              Checking your account...
            </section>
          ) : !user ? (
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
                <h2 className="brand-copy text-3xl text-[#2b2a29]">Sign in to view your profile</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                  Use your account to view saved addresses and orders linked to your checkout history.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN IN WITH GOOGLE
                </button>
                {profileError ? <p className="mt-4 text-sm text-[#9d4b45]">{profileError}</p> : null}
              </div>

              <aside className="rounded-[2rem] border border-[#e3d8c9] bg-white/72 p-8">
                <h3 className="brand-copy text-2xl text-[#2b2a29]">What you will see</h3>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                  <li>Saved delivery addresses from checkout.</li>
                  <li>Orders linked to your signed-in account.</li>
                  <li>One place to manage addresses and view order history.</li>
                </ul>
              </aside>
            </section>
          ) : (
            <div className="grid gap-8 xl:grid-cols-[370px_minmax(0,1fr)]">
              <aside className="space-y-6">
                <section className="rounded-[2rem] border border-[#d9cebe] bg-[#fffaf2] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.1)] sm:p-7">
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                    PROFILE
                  </p>
                  <h2 className="brand-copy mt-4 text-2xl text-[#2b2a29]">
                    {user.displayName || "Eshwe Customer"}
                  </h2>
                  <p className="mt-2 text-sm text-[#667056]">{user.email}</p>
                </section>

                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                        SAVED ADDRESSES
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <h2 className="brand-copy text-2xl text-[#2b2a29]">Your addresses</h2>
                        <button
                          type="button"
                          onClick={handleOpenAddressDialog}
                          className="brand-caption inline-flex border-b border-[#5e684f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                        >
                          ADD NEW
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {profileMessage ? <p className="text-sm text-[#5e684f]">{profileMessage}</p> : null}
                    {profileError ? <p className="text-sm text-[#9d4b45]">{profileError}</p> : null}
                    {profileLoading ? (
                      <p className="text-sm text-[#667056]">Loading saved addresses...</p>
                    ) : savedAddresses.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                        No saved address yet. Add one here.
                      </div>
                    ) : (
                      savedAddresses.map((address, index) => (
                        <article
                          key={address.id}
                          className="rounded-[1.35rem] border border-[#e8dccd] bg-[#fbf4e8] p-5 shadow-[0_10px_25px_rgba(94,104,79,0.04)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-[#3f4738]">
                                {address.label || `Address ${index + 1}`}
                              </p>
                              {address.id === selectedAddressId ? (
                                <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5e684f]">
                                  CURRENT
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEditSavedAddress(address)}
                              className="rounded-full border border-[#d6ccb9] bg-white/72 px-3 py-1.5 text-[0.68rem] font-semibold text-[#4f5942]"
                            >
                              Edit
                            </button>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-[#667056]">
                            {address.fullName}
                            <br />
                            {address.address}
                            <br />
                            {address.city}, {address.state} - {address.pincode}
                            <br />
                            {address.phone}
                            <br />
                            {address.email}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </aside>

              <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      MY ORDERS
                    </p>
                    <h2 className="brand-copy mt-3 text-2xl text-[#2b2a29]">Order history</h2>
                  </div>
                  <span className="rounded-full bg-white/72 px-4 py-2 text-xs font-semibold text-[#5e684f]">
                    {orders.length}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {ordersError ? <p className="text-sm text-[#9d4b45]">{ordersError}</p> : null}
                  {ordersLoading ? (
                    <p className="text-sm text-[#667056]">Loading your orders...</p>
                  ) : orders.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">
                      No orders linked to this account yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] shadow-[0_10px_25px_rgba(94,104,79,0.04)]">
                      <div className="hidden grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1fr] gap-4 border-b border-[#e4d8c8] bg-white/55 px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] md:grid">
                        <span>Order</span>
                        <span>Date</span>
                        <span>Total</span>
                        <span>Items</span>
                        <span>Status</span>
                        <span>Details</span>
                      </div>

                      {orders.map((order, index) => (
                        <article
                          key={order.id}
                          className={`px-5 py-4 ${index !== orders.length - 1 ? "border-b border-[#eadfce]" : ""}`}
                        >
                          <div className="grid gap-3 md:grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1fr] md:items-center md:gap-4">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Order
                              </p>
                              <p className="text-sm font-semibold text-[#2b2a29]">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </p>
                            </div>

                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Date
                              </p>
                              <p className="text-sm text-[#4f5942]">{formatTimestamp(order.createdAt)}</p>
                            </div>

                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Total
                              </p>
                              <p className="text-sm text-[#2b2a29]">{formatCurrency(order.amountBreakdown?.total)}</p>
                            </div>

                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Items
                              </p>
                              <p className="text-sm text-[#4f5942]">
                                {order.cartItems?.length || 0}
                              </p>
                            </div>

                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Status
                              </p>
                              <p className="text-sm font-medium text-[#5e684f]">{formatOrderStatus(order)}</p>
                            </div>

                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                Details
                              </p>
                              <button
                                type="button"
                                onClick={() => handleViewOrderDetails(order)}
                                className="brand-caption inline-flex border-b border-[#7d876f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#4f5942]"
                              >
                                VIEW ORDER DETAILS
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
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
          <AccountInput label="Address label" value={form.label} onChange={(value) => onFieldChange("label", value)} />
          <AccountInput label="Full name" value={form.fullName} onChange={(value) => onFieldChange("fullName", value)} />
          <AccountInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => onFieldChange("email", value)}
          />
          <AccountInput
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(value) => onFieldChange("phone", value)}
          />
          <AccountInput
            label="Pincode"
            value={form.pincode}
            onChange={(value) => onFieldChange("pincode", value)}
          />
          <AccountInput label="City" value={form.city} onChange={(value) => onFieldChange("city", value)} />
          <AccountInput label="State" value={form.state} onChange={(value) => onFieldChange("state", value)} />
          <div className="sm:col-span-2">
            <AccountInput label="Address" value={form.address} onChange={(value) => onFieldChange("address", value)} />
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

function AccountInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
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

function buildDeliveryAddress(form: AddressDialogFormState) {
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
  const deliveryAddress = buildDeliveryAddress(form);

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

function formatTimestamp(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value.toDate());
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value || 0);
}

function formatOrderStatus(order: CheckoutOrder) {
  if (order.paymentStatus === "captured" || order.status === "paid") {
    return "PAID";
  }

  if (order.paymentStatus === "failed" || order.status === "payment_failed") {
    return "FAILED";
  }

  if (order.paymentStatus === "authorized" || order.status === "authorized") {
    return "AUTHORIZED";
  }

  return "PENDING";
}

function buildOrderSlipHtml(order: CheckoutOrder, origin: string) {
  const items = (order.cartItems || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e6dccf;">
            <div style="font-weight:600;color:#2b2a29;">${escapeHtml(item.name)}</div>
            <div style="margin-top:4px;font-size:12px;color:#667056;">
              SKU ${escapeHtml(item.sku)}${item.color ? ` · ${escapeHtml(item.color)}` : ""}
            </div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e6dccf;text-align:right;color:#4f5942;">Qty ${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e6dccf;text-align:right;color:#2b2a29;font-weight:600;">${escapeHtml(
            formatCurrency(item.unitPrice)
          )}</td>
        </tr>
      `
    )
    .join("");

  const addressLines = [
    order.customer?.fullName || "NA",
    order.customer?.address || "NA",
    [order.customer?.city, order.customer?.state].filter(Boolean).join(", "),
    order.customer?.pincode || "",
    order.customer?.phone || "",
    order.customer?.email || ""
  ]
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(order.id)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f6efe3;
        color: #3f4738;
        font-family: Georgia, "Times New Roman", serif;
      }
      .page {
        max-width: 920px;
        margin: 0 auto;
        padding: 32px;
      }
      .slip {
        background: #fffdf9;
        border: 1px solid #cdbda8;
        border-radius: 28px;
        padding: 28px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e5d9c9;
      }
      .logo-wrap {
        border: 1px solid #d7cab6;
        background: #fbf4e8;
        border-radius: 18px;
        padding: 10px;
      }
      .caption {
        font: 600 11px/1.2 Arial, sans-serif;
        letter-spacing: 0.18em;
        color: #7d876f;
      }
      h1 {
        margin: 8px 0 0;
        font-size: 34px;
        line-height: 1.05;
        font-weight: 600;
        color: #2b2a29;
      }
      .sub {
        margin-top: 8px;
        font: 14px/1.6 Arial, sans-serif;
        color: #667056;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        margin-top: 24px;
      }
      .card {
        border: 1px solid #e6dccf;
        background: #fbf7ef;
        border-radius: 22px;
        padding: 16px;
      }
      .card-title {
        font: 600 11px/1.2 Arial, sans-serif;
        letter-spacing: 0.14em;
        color: #7d876f;
      }
      .meta {
        margin-top: 12px;
        font: 14px/1.7 Arial, sans-serif;
        color: #4f5942;
      }
      .meta strong {
        color: #2b2a29;
      }
      .items {
        margin-top: 24px;
        border: 1px solid #e6dccf;
        background: #fbf7ef;
        border-radius: 22px;
        padding: 16px;
      }
      .items-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e7dccb;
        font: 600 11px/1.2 Arial, sans-serif;
        letter-spacing: 0.14em;
        color: #7d876f;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font: 14px/1.6 Arial, sans-serif;
      }
      @media print {
        body {
          background: white;
        }
        .page {
          max-width: none;
          padding: 0;
        }
        .slip {
          border-radius: 0;
          border-color: #3f4738;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="slip">
        <div class="header">
          <div class="logo-wrap">
            <img src="${escapeHtml(origin)}/eshwelogo-transparent.png" alt="Eshwe" width="58" height="58" />
          </div>
          <div>
            <div class="caption">ESHWE SAREE STUDIO</div>
            <h1>Order Slip</h1>
            <div class="sub">${escapeHtml(order.customer?.fullName || "Customer")} · ${escapeHtml(
    formatTimestamp(order.createdAt)
  )}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">ORDER</div>
            <div class="meta">
              <div><strong>Order ID:</strong> ${escapeHtml(order.id)}</div>
              <div><strong>Phone:</strong> ${escapeHtml(order.customer?.phone || "NA")}</div>
              <div><strong>Email:</strong> ${escapeHtml(order.customer?.email || "NA")}</div>
              <div><strong>Payment:</strong> ${escapeHtml(formatPaymentMethod(order.paymentMethod))}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">TOTAL</div>
            <div class="meta">
              <div><strong>Subtotal:</strong> ${escapeHtml(formatCurrency(order.amountBreakdown?.subtotal))}</div>
              <div><strong>Shipping:</strong> ${escapeHtml(formatCurrency(order.amountBreakdown?.shippingFee))}</div>
              <div><strong>Packaging:</strong> ${escapeHtml(formatCurrency(order.amountBreakdown?.packagingFee))}</div>
              <div><strong>Total:</strong> ${escapeHtml(formatCurrency(order.amountBreakdown?.total))}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">STATUS</div>
            <div class="meta">
              <div><strong>Order Status:</strong> ${escapeHtml(formatOrderStatus(order))}</div>
              ${
                order.dispatchStatus === "completed"
                  ? `<div><strong>Dispatch:</strong> Completed</div>`
                  : `<div><strong>Dispatch:</strong> In progress</div>`
              }
            </div>
          </div>

          <div class="card">
            <div class="card-title">DELIVERY ADDRESS</div>
            <div class="meta">${addressLines}</div>
          </div>
        </div>

        <div class="items">
          <div class="items-head">
            <span>ORDER ITEMS</span>
            <span>${order.cartItems?.length || 0} item${order.cartItems?.length === 1 ? "" : "s"}</span>
          </div>
          <table>
            <tbody>
              ${items}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <script>
      window.addEventListener("load", function () {
        window.focus();
      });
    </script>
  </body>
</html>`;
}

function formatPaymentMethod(value?: string | null) {
  if (!value) {
    return "Razorpay";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
