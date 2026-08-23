import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { WaitlistEntry } from "@/types/waitlist-entry";

const WAITLIST_COLLECTION = "waitlistEntries";

export async function createWaitlistEntry(
  entry: Pick<
    WaitlistEntry,
    | "productId"
    | "productName"
    | "productSlug"
    | "productSku"
    | "productCategory"
    | "email"
    | "phone"
    | "sourcePath"
  >
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  if (!entry.email.trim() && !entry.phone.trim()) {
    throw new Error("Enter an email address or phone number.");
  }

  return addDoc(collection(db, WAITLIST_COLLECTION), {
    productId: entry.productId.trim(),
    productName: entry.productName.trim(),
    productSlug: entry.productSlug.trim(),
    productSku: entry.productSku.trim(),
    productCategory: entry.productCategory.trim(),
    email: entry.email.trim(),
    phone: entry.phone.trim(),
    sourcePath: entry.sourcePath.trim() || "/",
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function subscribeToWaitlistEntries(
  onData: (entries: WaitlistEntry[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const waitlistQuery = query(
    collection(db, WAITLIST_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    waitlistQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((waitlistDoc) => ({
          id: waitlistDoc.id,
          ...waitlistDoc.data()
        })) as WaitlistEntry[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}
