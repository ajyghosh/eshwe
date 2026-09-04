"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";
import { getCustomerAuthDisplayLabel, syncCustomerDisplayName } from "@/lib/auth";
import { getPurchasableQuantityLimit, isProductPurchasable } from "@/lib/inventory";
import { openOrderReceiptPreview, type OrderConfirmationData } from "@/lib/order-confirmation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profiles";
import { buildReorderSelections, subscribeToCustomerOrders } from "@/lib/orders";
import { subscribeToSarees } from "@/lib/sarees";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import type { CustomerAddress } from "@/types/customer-profile";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

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
  const router = useRouter();
  const { user, loading, signIn } = useAuthSession();
  const { favoriteSkus, favoritesCount } = useFavorites();
  const { addItem, items, removeItem, updateQuantity } = useCart();
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [catalogueProducts, setCatalogueProducts] = useState<Saree[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersMessage, setOrdersMessage] = useState<string | null>(null);
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

        const nextSavedAddresses = (customerProfile?.addresses ?? []).map((address) =>
          applyVerifiedPhoneToAddress(address, user?.phoneNumber)
        );
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
    if (!user?.uid) {
      setCatalogueProducts([]);
      setCatalogueLoading(false);
      return;
    }

    setCatalogueLoading(true);

    return subscribeToSarees(
      (nextProducts) => {
        setCatalogueProducts(nextProducts.filter((product) => product.status !== "draft"));
        setCatalogueLoading(false);
      },
      { status: ["active", "out_of_stock"] },
      () => {
        setCatalogueProducts([]);
        setCatalogueLoading(false);
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

  useEffect(() => {
    if (!ordersMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOrdersMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ordersMessage]);

  const favoriteProducts = useMemo(() => {
    if (favoriteSkus.length === 0 || catalogueProducts.length === 0) {
      return [];
    }

    const productsBySku = new Map(catalogueProducts.map((product) => [product.sku, product]));

    return favoriteSkus
      .map((sku) => productsBySku.get(sku))
      .filter((product): product is Saree => Boolean(product));
  }, [catalogueProducts, favoriteSkus]);

  const unavailableFavoritesCount = Math.max(favoritesCount - favoriteProducts.length, 0);
  const customerAuthLabel = getCustomerAuthDisplayLabel(user);

  async function handleSignIn() {
    try {
      await signIn();
    } catch {
      setProfileError("Sign in failed.");
    }
  }

  function handleOpenOrderReceipt(order: CheckoutOrder) {
    openOrderReceiptPreview(buildOrderConfirmation(order));
  }

  function handleShopAgain(order: CheckoutOrder) {
    const reorderSelections = buildReorderSelections(order, catalogueProducts);

    if (reorderSelections.length === 0) {
      setOrdersMessage(null);
      setOrdersError("These items are no longer available to add back into the cart.");
      return;
    }

    reorderSelections.forEach(({ product, quantity }) => {
      addItem(product, quantity);
    });

    const totalAdded = reorderSelections.reduce((sum, selection) => sum + selection.quantity, 0);
    setOrdersError(null);
    setOrdersMessage(`${totalAdded} item${totalAdded === 1 ? "" : "s"} added to cart.`);
    router.push("/shop");
  }

  function handleAddFavoriteToBag(product: Saree) {
    if (!isProductPurchasable(product)) {
      return;
    }

    addItem(product, 1);
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
      phone: resolveVerifiedPhone(user?.phoneNumber),
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
      phone: resolveVerifiedPhone(user?.phoneNumber, address.phone),
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

    const nextAddress = buildCustomerAddress(
      addressDialogForm,
      savedAddresses.length,
      editingAddressId,
      user.phoneNumber
    );

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

      await syncCustomerDisplayName(nextAddress.fullName);
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
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">ACCOUNT</p>
              <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
                Your profile, addresses, and orders.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
                Review saved addresses and your recent orders in one place.
              </p>
            </div>
            {user ? (
              <p className="brand-copy text-xl text-[#3f4738] sm:pb-1 sm:text-2xl">
                {user.displayName || customerAuthLabel || "Eshwe Customer"}
              </p>
            ) : null}
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
                  Use your mobile account to view saved addresses, favorites, and orders linked to your checkout history.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  CONTINUE WITH SMS
                </button>
                {profileError ? <p className="mt-4 text-sm text-[#9d4b45]">{profileError}</p> : null}
              </div>

              <aside className="rounded-[2rem] border border-[#e3d8c9] bg-white/72 p-8">
                <h3 className="brand-copy text-2xl text-[#2b2a29]">What you will see</h3>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                  <li>Saved delivery addresses from checkout.</li>
                  <li>Favorites you saved while browsing.</li>
                  <li>Orders linked to your signed-in account.</li>
                  <li>One place to manage addresses and revisit saved pieces.</li>
                </ul>
              </aside>
            </section>
          ) : (
            <div className="grid gap-8 xl:grid-cols-[370px_minmax(0,1fr)]">
              <aside>
                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                        SAVED ADDRESSES
                      </p>
                      <h2 className="brand-copy mt-3 text-2xl text-[#2b2a29]">Your address</h2>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {profileMessage ? <p className="text-sm text-[#5e684f]">{profileMessage}</p> : null}
                    {profileError ? <p className="text-sm text-[#9d4b45]">{profileError}</p> : null}
                    {profileLoading ? (
                      <p className="text-sm text-[#667056]">Loading saved addresses...</p>
                    ) : savedAddresses.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                        <p>No saved address yet. Add your address here.</p>
                        <button
                          type="button"
                          onClick={handleOpenAddressDialog}
                          className="brand-caption mt-4 inline-flex rounded-full border border-[#cbbda5] bg-[#fff8eb] px-4 py-2 text-[0.58rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                        >
                          ADD ADDRESS
                        </button>
                      </div>
                    ) : (
                      savedAddresses.map((address, index) => (
                        <article
                          key={address.id}
                          className={`rounded-[1.2rem] border px-4 py-4 shadow-[0_10px_25px_rgba(94,104,79,0.04)] ${
                            address.id === selectedAddressId
                              ? "border-[#cabb9f] bg-[#fffaf2]"
                              : "border-[#e8dccd] bg-[#fbf4e8]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[#3f4738]">
                                {address.fullName}
                              </p>
                              {address.id === selectedAddressId ? (
                                <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5e684f]">
                                  SAVED
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
                          <p className="mt-2 text-sm leading-6 text-[#667056]">
                            {address.address}, {address.city}, {address.state} - {address.pincode}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#667056]">
                            {address.phone} · {address.email}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </aside>

              <div className="space-y-8">
                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                        FAVORITES
                      </p>
                      <h2 className="brand-copy mt-3 text-2xl text-[#2b2a29]">Saved pieces</h2>
                      <p className="mt-2 text-sm text-[#667056]">Sarees you marked to revisit later.</p>
                    </div>
                    <span className="rounded-full bg-white/72 px-4 py-2 text-xs font-semibold text-[#5e684f]">
                      {favoritesCount}
                    </span>
                  </div>

                  <div className="mt-6 space-y-4">
                    {catalogueLoading && favoritesCount > 0 ? (
                      <p className="text-sm text-[#667056]">Loading your saved pieces...</p>
                    ) : favoritesCount === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">
                        No favorites yet. Tap the heart on any saree to save it here.
                      </div>
                    ) : favoriteProducts.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">
                        Your saved sarees are not available to display right now.
                      </div>
                    ) : (
                      <>
                        {unavailableFavoritesCount > 0 ? (
                          <p className="text-sm text-[#667056]">
                            {unavailableFavoritesCount} saved {unavailableFavoritesCount === 1 ? "piece is" : "pieces are"} unavailable right now.
                          </p>
                        ) : null}
                        <div className="space-y-3">
                          {favoriteProducts.map((product) => (
                            <FavoriteRow
                              key={product.sku}
                              product={product}
                              cartQuantity={items.find((item) => item.sku === product.sku)?.quantity ?? 0}
                              onAddToBag={handleAddFavoriteToBag}
                              onDecreaseQuantity={() => updateQuantity(product.sku, (items.find((item) => item.sku === product.sku)?.quantity ?? 0) - 1)}
                              onIncreaseQuantity={() => updateQuantity(product.sku, (items.find((item) => item.sku === product.sku)?.quantity ?? 0) + 1)}
                              onRemoveFromBag={() => removeItem(product.sku)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>

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
                    {ordersMessage ? <p className="text-sm text-[#5e684f]">{ordersMessage}</p> : null}
                    {ordersLoading ? (
                      <p className="text-sm text-[#667056]">Loading your orders...</p>
                    ) : orders.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">
                        No orders linked to this account yet.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-hidden rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] shadow-[0_10px_25px_rgba(94,104,79,0.04)]">
                          <div className="hidden grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1.25fr] gap-4 border-b border-[#e4d8c8] bg-white/55 px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] md:grid">
                            <span>Order</span>
                            <span>Date</span>
                            <span>Total</span>
                            <span>Items</span>
                            <span>Status</span>
                            <span>Actions</span>
                          </div>

                          {orders.map((order, index) => (
                            <article
                              key={order.id}
                              className={`px-5 py-4 ${index !== orders.length - 1 ? "border-b border-[#eadfce]" : ""}`}
                            >
                              <div className="grid gap-3 md:grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1.25fr] md:items-center md:gap-4">
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
                                  <p className="text-sm text-[#4f5942]">{order.cartItems?.length || 0}</p>
                                </div>

                                <div>
                                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                    Status
                                  </p>
                                  <p className="text-sm font-medium text-[#5e684f]">{formatOrderStatus(order)}</p>
                                </div>

                                <div>
                                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">
                                    Actions
                                  </p>
                                  <div className="flex flex-wrap gap-3 md:justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenOrderReceipt(order)}
                                      className="brand-caption inline-flex border-b border-[#7d876f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#4f5942]"
                                    >
                                      VIEW RECEIPT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleShopAgain(order)}
                                      className="brand-caption inline-flex border-b border-[#7d876f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#4f5942]"
                                    >
                                      SHOP AGAIN
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </section>

      <AddressDialog
        open={addressDialogOpen}
        form={addressDialogForm}
        editing={Boolean(editingAddressId)}
        pending={profileSaving}
        verifiedPhone={resolveVerifiedPhone(user?.phoneNumber, addressDialogForm.phone)}
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
  verifiedPhone,
  onClose,
  onFieldChange,
  onSave
}: {
  open: boolean;
  form: AddressDialogFormState;
  editing: boolean;
  pending: boolean;
  verifiedPhone: string;
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
            value={verifiedPhone}
            onChange={() => undefined}
            readOnly
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
        <p className="mt-3 text-xs leading-6 text-[#7d876f]">
          Mobile number is locked to the verified OTP account. To use a different number, sign in with that number first.
        </p>

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
  type = "text",
  readOnly = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className={`h-[52px] w-full rounded-[1rem] border border-[#d6ccb9] px-4 text-sm text-[#2b2a29] outline-none transition-colors duration-200 ${
          readOnly ? "bg-[#f3eee4] text-[#6d725f]" : "bg-[#fbf7ef] focus:border-[#5e684f]"
        }`}
      />
    </label>
  );
}

function buildDeliveryAddress(form: AddressDialogFormState, verifiedPhone?: string | null) {
  const lockedPhone = resolveVerifiedPhone(verifiedPhone, form.phone);

  if (
    !form.fullName.trim() ||
    !form.email.trim() ||
    !lockedPhone ||
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
    phone: lockedPhone,
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim()
  };
}

function buildCustomerAddress(
  form: AddressDialogFormState,
  existingAddressCount: number,
  addressId?: string,
  verifiedPhone?: string | null
) {
  const deliveryAddress = buildDeliveryAddress(form, verifiedPhone);

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

function resolveVerifiedPhone(verifiedPhone: string | null | undefined, fallback = "") {
  const normalizedVerifiedPhone = typeof verifiedPhone === "string" ? verifiedPhone.trim() : "";

  if (normalizedVerifiedPhone) {
    return normalizedVerifiedPhone;
  }

  return fallback.trim();
}

function applyVerifiedPhoneToAddress(address: CustomerAddress, verifiedPhone: string | null | undefined) {
  const lockedPhone = resolveVerifiedPhone(verifiedPhone, address.phone);

  if (lockedPhone === address.phone) {
    return address;
  }

  return {
    ...address,
    phone: lockedPhone
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

function FavoriteRow({
  product,
  cartQuantity,
  onAddToBag,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onRemoveFromBag
}: {
  product: Saree;
  cartQuantity: number;
  onAddToBag: (product: Saree) => void;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  onRemoveFromBag: () => void;
}) {
  const productHref = buildProductDetailHref(product.slug);
  const inBag = cartQuantity > 0;
  const canIncreaseQuantity = cartQuantity < getPurchasableQuantityLimit(product.availableStock);

  return (
    <article className="flex flex-col gap-4 rounded-[1.2rem] border border-[#e4d8c8] bg-[#fffaf2] p-4 shadow-[0_10px_24px_rgba(94,104,79,0.04)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={productHref} className="block shrink-0">
          <div
            className="h-20 w-16 rounded-[0.9rem] border border-[#eadfce] bg-[#efe5d7]"
            style={{
              backgroundImage: product.primaryImageUrl
                ? `linear-gradient(180deg, rgba(255,249,236,0.05), rgba(43,24,14,0.1)), url('${product.primaryImageUrl}')`
                : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)",
              backgroundPosition: "center",
              backgroundSize: "cover"
            }}
          />
        </Link>

        <div className="min-w-0">
          <Link href={productHref} className="block">
            <h3 className="brand-copy truncate text-lg text-[#2b2a29]">{product.name}</h3>
          </Link>
          <p className="mt-1 text-sm text-[#667056]">
            {product.fabric}
            {product.color ? ` · ${product.color}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[#1f1a17]">{formatCurrency(product.price)}</span>
            {typeof product.originalPrice === "number" ? (
              <span className="text-sm text-[#8d8b87] line-through">{formatCurrency(product.originalPrice)}</span>
            ) : null}
            {product.status === "out_of_stock" ? (
              <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.66rem] font-semibold text-[#5e684f]">
                OUT OF STOCK
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {product.status === "out_of_stock" ? null : inBag ? (
          <>
            <div className="inline-flex items-center rounded-full bg-[#5e684f] px-1.5 py-1 text-[#fbf4e8]">
              <button
                type="button"
                onClick={onDecreaseQuantity}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base leading-none"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="min-w-[1.75rem] text-center text-[0.76rem] font-semibold">{cartQuantity}</span>
              <button
                type="button"
                onClick={onIncreaseQuantity}
                disabled={!canIncreaseQuantity}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base leading-none disabled:opacity-45"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={onRemoveFromBag}
              className="brand-caption inline-flex items-center justify-center rounded-full border border-[#d6ccb9] px-4 py-2.5 text-[0.58rem] font-semibold tracking-[0.08em] text-[#8d5c56]"
            >
              REMOVE FROM BAG
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onAddToBag(product)}
            className="brand-caption inline-flex items-center justify-center rounded-full bg-[#5e684f] px-4 py-2.5 text-[0.58rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
          >
            ADD TO BAG
          </button>
        )}

        <Link
          href={productHref}
          className="brand-caption inline-flex items-center justify-center rounded-full border border-[#d6ccb9] px-4 py-2.5 text-[0.58rem] font-semibold tracking-[0.08em] text-[#5e684f]"
        >
          VIEW DETAILS
        </Link>
      </div>
    </article>
  );
}

function buildOrderConfirmation(order: CheckoutOrder) {
  return {
    createdAtIso: buildOrderCreatedAtIso(order.createdAt),
    customer: {
      address: order.customer?.address || "",
      city: order.customer?.city || "",
      email: order.customer?.email || "",
      fullName: order.customer?.fullName || "Customer",
      phone: order.customer?.phone || "",
      pincode: order.customer?.pincode || "",
      state: order.customer?.state || ""
    },
    internalOrderId: order.id,
    items: (order.cartItems ?? []).map((item) => ({
      color: item.color,
      name: item.name,
      primaryImageUrl: item.primaryImageUrl,
      quantity: item.quantity,
      sku: item.sku,
      unitOriginalPrice: item.unitOriginalPrice,
      unitPrice: item.unitPrice
    })),
    notes: order.notes || "",
    paymentStatus: order.paymentStatus || order.status || "pending",
    razorpayOrderId: order.razorpayOrderId || "",
    razorpayPaymentId: order.razorpayPaymentId || "",
    summary: {
      currency: order.currency || "INR",
      packagingFee: order.amountBreakdown?.packagingFee || 0,
      savings: order.amountBreakdown?.savings || 0,
      shippingFee: order.amountBreakdown?.shippingFee || 0,
      subtotal: order.amountBreakdown?.subtotal || 0,
      total: order.amountBreakdown?.total || 0
    }
  } satisfies OrderConfirmationData;
}

function buildOrderCreatedAtIso(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") {
    return new Date().toISOString();
  }

  return value.toDate().toISOString();
}
