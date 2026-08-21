import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CategoryCard, HomePageContent } from "@/types/homepage";

const SITE_CONTENT_COLLECTION = "siteContent";
const HOMEPAGE_DOCUMENT_ID = "homepage";
const CATEGORY_COLLECTION = "categoryCards";

export function subscribeToHomePageContent(
  onData: (content: HomePageContent | null) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData(null);
    return () => undefined;
  }

  const homepageRef = doc(db, SITE_CONTENT_COLLECTION, HOMEPAGE_DOCUMENT_ID);

  return onSnapshot(
    homepageRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      onData({
        id: snapshot.id,
        ...snapshot.data()
      } as HomePageContent);
    },
    (error) => {
      onData(null);
      onError?.(error);
    }
  );
}

export async function saveHomePageContent(content: Omit<HomePageContent, "id" | "updatedAt">) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return setDoc(
    doc(db, SITE_CONTENT_COLLECTION, HOMEPAGE_DOCUMENT_ID),
    {
      ...content,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function subscribeToCategoryCards(
  onData: (cards: CategoryCard[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const cardsQuery = query(collection(db, CATEGORY_COLLECTION), orderBy("sortOrder", "asc"));

  return onSnapshot(
    cardsQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data()
        })) as CategoryCard[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function createCategoryCard(card: Omit<CategoryCard, "id" | "createdAt" | "updatedAt">) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return addDoc(collection(db, CATEGORY_COLLECTION), {
    ...card,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateCategoryCard(
  id: string,
  updates: Partial<Omit<CategoryCard, "id" | "createdAt">>
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return updateDoc(doc(db, CATEGORY_COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteCategoryCard(id: string) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return deleteDoc(doc(db, CATEGORY_COLLECTION, id));
}
