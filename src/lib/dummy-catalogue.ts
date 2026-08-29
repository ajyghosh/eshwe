"use client";

import { Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { slugifySareeName } from "@/lib/sarees";
import type { ProductMasterOption } from "@/types/product-master-option";
import type { ProductGroup } from "@/types/product-group";
import type { Saree } from "@/types/saree";

const DUMMY_PRODUCTS_PER_CATEGORY = 100;
const DUMMY_IMAGE_SET = [
  "/home.PNG",
  "/hero.webp",
  "/eshwelogo.png",
  "/eshwelogo-transparent.png"
] as const;
const FALLBACK_CATEGORIES = ["Kanchi Cotton", "Sungudi Cotton", "Tissue Silk", "Mul Cotton", "Soft Silk"] as const;
const FALLBACK_FABRICS = ["Cotton", "Silk", "Mul Cotton", "Tissue", "Soft Silk"] as const;
const FALLBACK_COLORS = ["Maroon", "Olive", "Ivory", "Teal", "Gold", "Rose"] as const;
const FALLBACK_COLLECTION_LABELS = ["Wedding Edit", "Soft Launch", "Festive Curation", "Everyday Drape"] as const;
const OCCASION_ROTATIONS: Array<Saree["occasionTags"]> = [
  ["Wedding"],
  ["Gifting"],
  ["Everyday"],
  ["Wedding", "Gifting"],
  ["Everyday", "Gifting"],
  []
] as const;

type SeedDummyCatalogueOptions = {
  existingProducts: Saree[];
  productGroups: ProductGroup[];
  productMasterOptions: ProductMasterOption[];
};

type SeedDummyCatalogueResult = {
  categories: string[];
  created: number;
  skipped: number;
};

export async function seedDummyCatalogue({
  existingProducts,
  productGroups,
  productMasterOptions
}: SeedDummyCatalogueOptions): Promise<SeedDummyCatalogueResult> {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const categories = getSeedCategories(existingProducts, productGroups);
  const fabrics = getOptionsByType(productMasterOptions, "fabric", FALLBACK_FABRICS);
  const colors = getOptionsByType(productMasterOptions, "color", FALLBACK_COLORS);
  const collectionLabels = getOptionsByType(productMasterOptions, "collection_label", FALLBACK_COLLECTION_LABELS);
  const existingSkus = new Set(existingProducts.map((product) => product.sku.trim().toUpperCase()));

  let created = 0;
  let skipped = 0;

  for (const category of categories) {
    for (let index = 0; index < DUMMY_PRODUCTS_PER_CATEGORY; index += 1) {
      const payload = buildDummyProduct({
        category,
        collectionLabels,
        colors,
        fabrics,
        index
      });

      if (existingSkus.has(payload.sku)) {
        skipped += 1;
        continue;
      }

      await addDoc(collection(db, "sarees"), payload);
      existingSkus.add(payload.sku);
      created += 1;
    }
  }

  return {
    categories,
    created,
    skipped
  };
}

function buildDummyProduct({
  category,
  collectionLabels,
  colors,
  fabrics,
  index
}: {
  category: string;
  collectionLabels: string[];
  colors: string[];
  fabrics: string[];
  index: number;
}) {
  const categorySlug = slugifySareeName(category);
  const sku = `DUMMY-${categorySlug.toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
  const fabric = fabrics[index % fabrics.length] ?? FALLBACK_FABRICS[0];
  const color = colors[(index * 2) % colors.length] ?? FALLBACK_COLORS[0];
  const collectionLabel = collectionLabels[index % collectionLabels.length] ?? FALLBACK_COLLECTION_LABELS[0];
  const primaryImageUrl = DUMMY_IMAGE_SET[index % DUMMY_IMAGE_SET.length];
  const galleryImageUrls = DUMMY_IMAGE_SET.filter((_, imageIndex) => imageIndex !== index % DUMMY_IMAGE_SET.length).slice(
    0,
    index % 4
  );
  const originalPrice = 2499 + (index % 10) * 250;
  const price = index % 6 === 0 ? 1499 : originalPrice - (199 + (index % 4) * 100);
  const discountPercent = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
  const availableStock = [0, 1, 2, 4, 8, 12][index % 6];
  const status = availableStock === 0 ? "out_of_stock" : index % 13 === 0 ? "draft" : "active";
  const featured = index % 7 === 0;
  const occasionTags = OCCASION_ROTATIONS[index % OCCASION_ROTATIONS.length] ?? [];
  const seededDate = new Date(2026, (index * 3) % 12, (index % 28) + 1);
  const name = `${color} ${category} Test Saree ${String(index + 1).padStart(3, "0")}`;

  return {
    name,
    slug: slugifySareeName(`${name}-${sku}`),
    sku,
    category,
    fabric,
    color,
    description: buildDummyDescription(category, fabric, color, index),
    price,
    originalPrice,
    discountPercent: discountPercent > 0 ? discountPercent : null,
    collectionLabel,
    occasionTags,
    availableStock,
    status,
    featured,
    primaryImageUrl,
    primaryImagePath: null,
    galleryImageUrls,
    galleryImagePaths: [],
    length: index % 5 === 0 ? "6.3 m with blouse piece" : "6.2 m",
    washCare: index % 3 === 0 ? "Dry clean recommended" : "Gentle hand wash separately",
    productNote: index % 4 === 0 ? "Testing record for multi-state catalogue coverage." : "Testing record for checkout, filters, and discovery flows.",
    sareeCareTips: [
      "Store folded in a dry shelf.",
      "Use low heat ironing on the reverse side.",
      "Rotate the fold line between wears."
    ],
    dryingTips: [
      "Dry in shade.",
      "Avoid direct midday sun.",
      "Let the fabric cool before refolding."
    ],
    createdAt: Timestamp.fromDate(seededDate),
    updatedAt: serverTimestamp()
  } satisfies Omit<Saree, "id" | "updatedAt"> & { updatedAt: ReturnType<typeof serverTimestamp> };
}

function buildDummyDescription(category: string, fabric: string, color: string, index: number) {
  const mood = ["soft celebratory drape", "easy everyday pick", "giftable festive edit", "lightweight elegant weave"][index % 4];

  return `${color} ${category} in ${fabric}, created as a ${mood} for testing filters, PDP layouts, recommendations, checkout, and account flows.`;
}

function getSeedCategories(existingProducts: Saree[], productGroups: ProductGroup[]) {
  const activeGroups = productGroups.filter((group) => group.active).map((group) => group.name.trim()).filter(Boolean);
  const existingCategories = Array.from(new Set(existingProducts.map((product) => product.category.trim()).filter(Boolean)));
  const combinedCategories = Array.from(new Set([...activeGroups, ...existingCategories]));

  return combinedCategories.length > 0 ? combinedCategories : Array.from(FALLBACK_CATEGORIES);
}

function getOptionsByType<T extends readonly string[]>(
  options: ProductMasterOption[],
  type: ProductMasterOption["type"],
  fallback: T
) {
  const values = options
    .filter((option) => option.type === type && option.active)
    .map((option) => option.value.trim())
    .filter(Boolean);

  return values.length > 0 ? Array.from(new Set(values)) : Array.from(fallback);
}

