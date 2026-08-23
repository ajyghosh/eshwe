import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CustomerProfile } from "@/types/customer-profile";

const CUSTOMER_PROFILES_COLLECTION = "customerProfiles";

export async function getCustomerProfile(userId: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const customerProfileSnapshot = await getDoc(doc(db, CUSTOMER_PROFILES_COLLECTION, userId));

  if (!customerProfileSnapshot.exists()) {
    return null;
  }

  return {
    id: customerProfileSnapshot.id,
    ...customerProfileSnapshot.data()
  } as CustomerProfile;
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
