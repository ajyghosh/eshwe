import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp
} from "firebase/firestore";
import { updateDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Saree, SareeStatus } from "@/types/saree";

const COLLECTION_NAME = "sarees";

type SareeQueryOptions = {
  category?: string;
  featured?: boolean;
  status?: SareeStatus;
};

export async function getSarees(options: SareeQueryOptions = {}): Promise<Saree[]> {
  if (!db) {
    return [];
  }

  const sareesQuery = query(collection(db, COLLECTION_NAME), ...buildConstraints(options));
  const snapshot = await getDocs(sareesQuery);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  })) as Saree[];
}

export function subscribeToSarees(
  onData: (sarees: Saree[]) => void,
  options: SareeQueryOptions & { max?: number } = {},
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const constraints = buildConstraints(options);

  if (options.max) {
    constraints.push(limit(options.max));
  }

  const sareesQuery = query(collection(db, COLLECTION_NAME), ...constraints);

  return onSnapshot(
    sareesQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((productDoc) => ({
          id: productDoc.id,
          ...productDoc.data()
        })) as Saree[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function createSaree(
  saree: Omit<Saree, "id" | "createdAt" | "updatedAt">
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return addDoc(collection(db, COLLECTION_NAME), {
    ...saree,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateSaree(id: string, updates: Partial<Omit<Saree, "id" | "createdAt">>) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return updateDoc(doc(db, COLLECTION_NAME, id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteSaree(id: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return deleteDoc(doc(db, COLLECTION_NAME, id));
}

export function slugifySareeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildConstraints(options: SareeQueryOptions) {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

  if (options.category) {
    constraints.push(queryConstraint("category", options.category));
  }

  if (typeof options.featured === "boolean") {
    constraints.push(queryConstraint("featured", options.featured));
  }

  if (options.status) {
    constraints.push(queryConstraint("status", options.status));
  }

  return constraints;
}

function queryConstraint(field: string, value: boolean | string) {
  return where(field, "==", value);
}
