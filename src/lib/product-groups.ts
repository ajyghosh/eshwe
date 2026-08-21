import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { ProductGroup } from "@/types/product-group";

const PRODUCT_GROUP_COLLECTION = "productGroups";

export function subscribeToProductGroups(
  onData: (groups: ProductGroup[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const groupsQuery = query(collection(db, PRODUCT_GROUP_COLLECTION), orderBy("sortOrder", "asc"));

  return onSnapshot(
    groupsQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((groupDoc) => ({
          id: groupDoc.id,
          ...groupDoc.data()
        })) as ProductGroup[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function createProductGroup(group: Omit<ProductGroup, "id" | "createdAt" | "updatedAt">) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return addDoc(collection(db, PRODUCT_GROUP_COLLECTION), {
    ...group,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateProductGroup(
  id: string,
  updates: Partial<Omit<ProductGroup, "id" | "createdAt">>
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return updateDoc(doc(db, PRODUCT_GROUP_COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteProductGroup(id: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return deleteDoc(doc(db, PRODUCT_GROUP_COLLECTION, id));
}
