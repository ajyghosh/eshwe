import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";

const OWNER_ACCOUNTS_COLLECTION = "ownerAccounts";

export type OwnerAccount = {
  id?: string;
  email: string;
  addedBy?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function normalizeOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function subscribeToOwnerAccounts(
  onData: (owners: OwnerAccount[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const ownersQuery = query(collection(db, OWNER_ACCOUNTS_COLLECTION), orderBy("email", "asc"));

  return onSnapshot(
    ownersQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((ownerDoc) => ({
          id: ownerDoc.id,
          ...ownerDoc.data()
        })) as OwnerAccount[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function addOwnerAccount(email: string, addedBy?: string | null) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const normalizedEmail = normalizeOwnerEmail(email);

  if (!normalizedEmail) {
    throw new Error("Owner email is required.");
  }

  await setDoc(
    doc(db, OWNER_ACCOUNTS_COLLECTION, normalizedEmail),
    {
      email: normalizedEmail,
      addedBy: normalizeOwnerEmail(addedBy) || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function removeOwnerAccount(email: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const normalizedEmail = normalizeOwnerEmail(email);

  if (!normalizedEmail) {
    throw new Error("Owner email is required.");
  }

  await deleteDoc(doc(db, OWNER_ACCOUNTS_COLLECTION, normalizedEmail));
}
