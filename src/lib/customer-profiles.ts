import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { mergeCartSnapshots, normalizeCart } from "@/lib/cart-state";
import { applyCartMutation, type CartMutation } from "@/lib/cart-mutations";
import type { CartItem } from "@/types/cart";

import { db } from "@/lib/firebase";
import type { CustomerAddress, CustomerProfile } from "@/types/customer-profile";

const CUSTOMER_PROFILES_COLLECTION = "customerProfiles";

export function subscribeToCustomerProfile(userId: string, next: (profile: CustomerProfile | null) => void, error?: (error: Error) => void) {
  if (!db) { error?.(new Error("Customer profile is unavailable.")); return () => undefined; }
  return onSnapshot(doc(db,CUSTOMER_PROFILES_COLLECTION,userId), snapshot => next(snapshot.exists() ? normalizeCustomerProfile(snapshot.id,snapshot.data()) : null), error);
}

export function getSelectedAddress(profile: CustomerProfile | null) {
  return profile?.addresses?.find(address => address.id === profile.selectedAddressId) ?? profile?.addresses?.[0] ?? null;
}

export async function saveCustomerAddress(userId: string, address: CustomerAddress, expectedAddress?: CustomerAddress | null, select = true) {
  if (!db) throw new Error("Customer profile is unavailable.");
  const ref = doc(db,CUSTOMER_PROFILES_COLLECTION,userId);
  await runTransaction(db,async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? normalizeCustomerProfile(userId,snapshot.data()) : null;
    const addresses = current?.addresses ?? [];
    const previous = addresses.find(entry => entry.id === address.id);
    if (expectedAddress && JSON.stringify(previous) !== JSON.stringify(normalizeAddress(expectedAddress))) throw new Error("This address changed on another device. Reopen it before saving.");
    const next = previous ? addresses.map(entry => entry.id === address.id ? address : entry) : [...addresses,address];
    const selectedAddressId = select ? address.id : current?.selectedAddressId || address.id;
    const selected = next.find(entry=>entry.id===selectedAddressId) || address;
    transaction.set(ref, { ...selected, id: userId, addresses: next, selectedAddressId, ...(!snapshot.exists() ? {createdAt:serverTimestamp()} : {}), updatedAt:serverTimestamp() }, {merge:true});
  });
}

export async function selectCustomerAddress(userId: string, addressId: string) {
  if (!db) throw new Error("Customer profile is unavailable.");
  const ref=doc(db,CUSTOMER_PROFILES_COLLECTION,userId);
  await runTransaction(db,async tx=>{ const s=await tx.get(ref); const profile=normalizeCustomerProfile(userId,s.data()||{}); const address=profile.addresses?.find(a=>a.id===addressId); if(!address)throw new Error("Address no longer exists.");tx.set(ref,{...address,id:userId,selectedAddressId:addressId,updatedAt:serverTimestamp()},{merge:true}); });
}

export async function changeCustomerFavorites(userId: string, add: string[] = [], remove: string[] = [], migrationId?: string) {
  return updateCustomerFavorites(userId, skus => [...skus.filter(sku => !remove.includes(sku)), ...add], migrationId);
}

export async function updateCustomerFavorites(userId: string, change: (skus: string[]) => string[], migrationId?: string) {
  if (!db) throw new Error("Wishlist is unavailable.");
  const ref = doc(db,CUSTOMER_PROFILES_COLLECTION,userId);
  return runTransaction(db,async tx=>{
    const s=await tx.get(ref); const data=s.data()||{};
    const migrations=Array.isArray(data.favoriteMigrations)?data.favoriteMigrations:[];
    const previousRevision=Number.isSafeInteger(data.favoriteRevision)&&data.favoriteRevision>=0?data.favoriteRevision:0;
    const skus=normalizeFavoriteSkus(data.favoriteSkus);
    if(migrationId&&migrations.includes(migrationId))return {items:skus,revision:previousRevision};
    const items=normalizeFavoriteSkus(change(skus)); const revision=previousRevision+1;
    tx.set(ref,{...(migrationId?{favoriteMigrations:[...migrations,migrationId].slice(-30)}:{}),favoriteSkus:items,favoriteRevision:revision,updatedAt:serverTimestamp()},{merge:true});
    return {items,revision};
  });
}

export async function changeCustomerCart(userId: string, change: (items: CartItem[]) => CartItem[], migrationId?: string) {
  if (!db) throw new Error("Bag syncing is unavailable.");
  const ref=doc(db,CUSTOMER_PROFILES_COLLECTION,userId);
  return runTransaction(db,async tx=>{
    const s=await tx.get(ref); const data=s.data()||{}; const migrations=Array.isArray(data.cartMigrations)?data.cartMigrations:[];
    const previousRevision = Number.isSafeInteger(data.cartRevision) && data.cartRevision >= 0 ? data.cartRevision : 0;
    if(migrationId && migrations.includes(migrationId))return { items: normalizeCart(data.cartItems), revision: previousRevision };
    // JSON strips optional undefined fields before Firestore serialization.
    const cartItems = JSON.parse(JSON.stringify(normalizeCart(change(normalizeCart(data.cartItems))))) as CartItem[];
    const revision = previousRevision + 1;
    tx.set(ref,{cartItems,cartRevision:revision,...(migrationId?{cartMigrations:[...migrations,migrationId].slice(-30)}:{}),updatedAt:serverTimestamp()},{merge:true});
    return { items: cartItems, revision };
  });
}

export function migrateCustomerCart(userId: string, guest: CartItem[], migrationId: string) {
  return changeCustomerCart(userId,account=>mergeCartSnapshots(account,guest),migrationId);
}

export async function saveCustomerCartMutation(userId: string, operationId: string, mutation: CartMutation) {
  if (!db) throw new Error("Bag syncing is unavailable.");
  const profile = doc(db, CUSTOMER_PROFILES_COLLECTION, userId);
  const receipt = doc(db, `${CUSTOMER_PROFILES_COLLECTION}/${userId}/cartOperations`, operationId);
  return runTransaction(db, async tx => {
    const [snapshot, applied] = await Promise.all([tx.get(profile), tx.get(receipt)]);
    const data = snapshot.data() || {};
    const revision = Number.isSafeInteger(data.cartRevision) && data.cartRevision >= 0 ? data.cartRevision : 0;
    const items = normalizeCart(data.cartItems);
    // A response can be lost after commit. Keep receipts separate from the bag
    // so a retry cannot recreate purchased items, even after many later edits.
    if (applied.exists()) return { items, revision };
    const cartItems = JSON.parse(JSON.stringify(applyCartMutation(items, mutation))) as CartItem[];
    tx.set(profile, { cartItems, cartRevision: revision + 1, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(receipt, { appliedAt: serverTimestamp() });
    return { items: cartItems, revision: revision + 1 };
  });
}

export async function getCustomerProfile(userId: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const customerProfileSnapshot = await getDoc(doc(db, CUSTOMER_PROFILES_COLLECTION, userId));

  if (!customerProfileSnapshot.exists()) {
    return null;
  }

  return normalizeCustomerProfile(customerProfileSnapshot.id, customerProfileSnapshot.data());
}

function normalizeCustomerProfile(id: string, value: Record<string, unknown>) {
  const profile = value as Partial<CustomerProfile>;
  const normalizedAddresses = normalizeAddresses(profile);
  const selectedAddressId = resolveSelectedAddressId(profile.selectedAddressId, normalizedAddresses);
  const selectedAddress =
    normalizedAddresses.find((address) => address.id === selectedAddressId) ?? normalizedAddresses[0] ?? emptyAddress();

  return {
    id,
    fullName: selectedAddress.fullName,
    email: selectedAddress.email,
    phone: selectedAddress.phone,
    address: selectedAddress.address,
    city: selectedAddress.city,
    state: selectedAddress.state,
    pincode: selectedAddress.pincode,
    selectedAddressId: selectedAddressId || undefined,
    addresses: normalizedAddresses,
    favoriteSkus: normalizeFavoriteSkus(profile.favoriteSkus),
    favoriteRevision: Number.isSafeInteger(profile.favoriteRevision) && profile.favoriteRevision! >= 0 ? profile.favoriteRevision : 0,
    cartItems: normalizeCart(profile.cartItems),
    cartRevision: Number.isSafeInteger(profile.cartRevision) && profile.cartRevision! >= 0 ? profile.cartRevision : 0,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  } satisfies CustomerProfile;
}

function normalizeFavoriteSkus(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenSkus = new Set<string>();

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (seenSkus.has(entry)) {
        return false;
      }

      seenSkus.add(entry);
      return true;
    });
}

function normalizeAddresses(profile: Partial<CustomerProfile>) {
  const rawAddresses = Array.isArray(profile.addresses) ? profile.addresses : [];
  const normalizedAddresses = rawAddresses
    .map((address) => normalizeAddress(address))
    .filter((address): address is CustomerAddress => Boolean(address));

  if (normalizedAddresses.length > 0) {
    return normalizedAddresses;
  }

  const legacyAddress = normalizeAddress({
    id: "default",
    label: "Saved Address",
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    pincode: profile.pincode
  });

  return legacyAddress ? [legacyAddress] : [];
}

function normalizeAddress(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const address = value as Partial<CustomerAddress>;

  if (
    typeof address.id !== "string" ||
    typeof address.fullName !== "string" ||
    typeof address.email !== "string" ||
    typeof address.phone !== "string" ||
    typeof address.address !== "string" ||
    typeof address.city !== "string" ||
    typeof address.state !== "string" ||
    typeof address.pincode !== "string"
  ) {
    return null;
  }

  return {
    id: address.id,
    label: typeof address.label === "string" && address.label.trim() ? address.label.trim() : "Saved Address",
    fullName: address.fullName,
    email: address.email,
    phone: address.phone,
    address: address.address,
    city: address.city,
    state: address.state,
    pincode: address.pincode
  } satisfies CustomerAddress;
}

function resolveSelectedAddressId(selectedAddressId: unknown, addresses: CustomerAddress[]) {
  if (typeof selectedAddressId === "string" && addresses.some((address) => address.id === selectedAddressId)) {
    return selectedAddressId;
  }

  return addresses[0]?.id ?? "";
}

function emptyAddress(): CustomerAddress {
  return {
    id: "",
    label: "Saved Address",
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  };
}
