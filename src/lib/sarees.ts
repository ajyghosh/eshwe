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
  serverTimestamp,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { updateDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  defaultDryingTips,
  defaultProductLength,
  defaultProductNote,
  defaultSareeCareTips,
  defaultWashCare
} from "@/lib/product-detail-defaults";
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

export async function seedDummySarees() {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const firestore = db;
  const batch = writeBatch(firestore);
  const dummySarees = buildDummySarees();

  dummySarees.forEach((saree, index) => {
    const createdAt = Timestamp.fromDate(new Date(Date.now() - index * 60 * 60 * 1000));
    const documentRef = doc(firestore, COLLECTION_NAME, saree.sku);

    batch.set(documentRef, {
      ...saree,
      createdAt,
      updatedAt: createdAt
    });
  });

  await batch.commit();
}

function buildDummySarees(): Omit<Saree, "id" | "createdAt" | "updatedAt">[] {
  const categoryGroups = [
    {
      category: "Mul Cotton",
      fabric: "Mul Cotton",
      items: [
        ["Medha", "Berry Rose"],
        ["Niya", "Soft Coral"],
        ["Saanvi", "Olive Gold"],
        ["Charvi", "Misty Blue"],
        ["Veda", "Brick Bloom"]
      ]
    },
    {
      category: "Tissue",
      fabric: "Tissue",
      items: [
        ["Indra Green", "Emerald Glow"],
        ["Alli Black and Gold", "Midnight Gold"],
        ["Vidya", "Champagne Gold"],
        ["Mayoori", "Teal Jewel"],
        ["Aarini", "Wine Bronze"]
      ]
    },
    {
      category: "Kerala Sarees",
      fabric: "Kerala Cotton",
      items: [
        ["Shubha Red", "Kasavu Red"],
        ["Anagha", "Ivory Gold"],
        ["Devika Kasavu", "Temple Ivory"],
        ["Mridula Gold", "Warm Gold"],
        ["Neelima Ivory", "Pearl Cream"]
      ]
    },
    {
      category: "Festive Weaves",
      fabric: "Soft Silk",
      items: [
        ["Ziya Festive", "Ruby Wine"],
        ["Kairavi Glow", "Sunset Amber"],
        ["Sharada Bloom", "Royal Violet"],
        ["Tarini Weaves", "Peacock Green"],
        ["Meher Edit", "Marigold Gold"]
      ]
    },
    {
      category: "Soft Silk",
      fabric: "Soft Silk",
      items: [
        ["Iraa Silk", "Blush Plum"],
        ["Aaradhya Silk", "Moss Olive"],
        ["Rhea Ruby", "Ruby Pink"],
        ["Varnika Plum", "Deep Plum"],
        ["Sia Gold", "Muted Mustard"]
      ]
    },
    {
      category: "Kerala Cotton",
      fabric: "Kerala Cotton",
      items: [
        ["Malini White Gold", "Classic Cream"],
        ["Gauri Kasavu", "Soft White"],
        ["Nandita Cream", "Cream Sand"],
        ["Pournami Border", "Moon Ivory"],
        ["Thulasi Temple", "Leaf Green"]
      ]
    }
  ] as const;

  const statusPattern: SareeStatus[] = ["active", "active", "out_of_stock", "draft", "active"];
  const basePriceByCategory: Record<string, number> = {
    "Mul Cotton": 1499,
    Tissue: 1899,
    "Kerala Sarees": 1599,
    "Festive Weaves": 2199,
    "Soft Silk": 2399,
    "Kerala Cotton": 1699
  };

  return categoryGroups.flatMap((group, groupIndex) =>
    group.items.map(([name, color], itemIndex) => {
      const sequence = groupIndex * 5 + itemIndex + 1;
      const price = basePriceByCategory[group.category] + itemIndex * 120;
      const originalPrice = price + 300 + itemIndex * 80;
      const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
      const featured = itemIndex < 2 || (groupIndex + itemIndex) % 3 === 0;
      const status = statusPattern[itemIndex];
      const sku = `TEST${String(sequence).padStart(3, "0")}`;

      return {
        name,
        slug: slugifySareeName(name),
        sku,
        category: group.category,
        fabric: group.fabric,
        color,
        description: `${name} is a curated ${group.fabric.toLowerCase()} drape from the ${group.category.toLowerCase()} edit, designed for festive dressing, gifting, and elegant everyday wear.`,
        price,
        originalPrice,
        discountPercent,
        collectionLabel: `${name} Collection`,
        status,
        featured,
        primaryImageUrl: "/home.PNG",
        primaryImagePath: null,
        galleryImageUrls: ["/home.PNG", "/home.PNG"],
        galleryImagePaths: [],
        length: defaultProductLength,
        washCare: defaultWashCare,
        productNote: defaultProductNote,
        sareeCareTips: defaultSareeCareTips,
        dryingTips: defaultDryingTips
      };
    })
  );
}
