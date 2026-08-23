import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CustomerAddress, CustomerProfile } from "@/types/customer-profile";

const CUSTOMER_PROFILES_COLLECTION = "customerProfiles";

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

export async function saveCustomerProfile(
  userId: string,
  profile: Omit<CustomerProfile, "id" | "createdAt" | "updatedAt">
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  await setDoc(
    doc(db, CUSTOMER_PROFILES_COLLECTION, userId),
    {
      ...profile,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
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
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  } satisfies CustomerProfile;
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
