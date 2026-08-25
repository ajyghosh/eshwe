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
import { getEffectiveAvailabilityStatus, normalizeAvailableStock } from "@/lib/inventory";
import type { Saree, SareeStatus } from "@/types/saree";

const COLLECTION_NAME = "sarees";

type SareeQueryOptions = {
  category?: string;
  featured?: boolean;
  status?: SareeStatus | SareeStatus[];
};

export async function getSarees(options: SareeQueryOptions = {}): Promise<Saree[]> {
  if (!db) {
    return [];
  }

  const sareesQuery = query(collection(db, COLLECTION_NAME), ...buildConstraints(options));
  const snapshot = await getDocs(sareesQuery);

  return snapshot.docs.map((doc) => hydrateSaree(doc.id, doc.data()));
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
        snapshot.docs.map((productDoc) => hydrateSaree(productDoc.id, productDoc.data()))
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

function hydrateSaree(id: string, data: Record<string, unknown>) {
  const availableStock = normalizeAvailableStock(data.availableStock);
  const status = getEffectiveAvailabilityStatus((data.status as SareeStatus) || "active", availableStock);

  return {
    id,
    ...data,
    availableStock,
    status
  } as Saree;
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
    constraints.push(statusQueryConstraint(options.status));
  }

  return constraints;
}

function queryConstraint(field: string, value: boolean | string) {
  return where(field, "==", value);
}

function statusQueryConstraint(value: SareeStatus | SareeStatus[]) {
  if (Array.isArray(value)) {
    return value.length === 1 ? where("status", "==", value[0]) : where("status", "in", value);
  }

  return where("status", "==", value);
}
