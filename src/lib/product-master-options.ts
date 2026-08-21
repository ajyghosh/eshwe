import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { ProductMasterOption } from "@/types/product-master-option";

const PRODUCT_MASTER_COLLECTION = "productMasterOptions";

export function subscribeToProductMasterOptions(
  onData: (options: ProductMasterOption[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, PRODUCT_MASTER_COLLECTION),
    (snapshot) => {
      const options = snapshot.docs
        .map((optionDoc) => ({
          id: optionDoc.id,
          ...optionDoc.data()
        })) as ProductMasterOption[];

      options.sort((left, right) => {
        if (left.type !== right.type) {
          return String(left.type).localeCompare(String(right.type));
        }

        if ((left.sortOrder ?? 0) !== (right.sortOrder ?? 0)) {
          return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
        }

        return String(left.value ?? "").localeCompare(String(right.value ?? ""));
      });

      onData(options);
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function createProductMasterOption(
  option: Omit<ProductMasterOption, "id" | "createdAt" | "updatedAt">
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return addDoc(collection(db, PRODUCT_MASTER_COLLECTION), {
    ...option,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateProductMasterOption(
  id: string,
  updates: Partial<Omit<ProductMasterOption, "id" | "createdAt">>
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return updateDoc(doc(db, PRODUCT_MASTER_COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteProductMasterOption(id: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return deleteDoc(doc(db, PRODUCT_MASTER_COLLECTION, id));
}
