import type { Saree } from "@/types/saree";

export const MANUAL_OCCASION_TAGS = ["Wedding", "Gifting", "Everyday"] as const;
export const AUTOMATIC_INTENT_TAGS = ["New", "Under ₹2,000"] as const;
export const SHOP_INTENT_TAGS = [...MANUAL_OCCASION_TAGS, ...AUTOMATIC_INTENT_TAGS] as const;

const NEW_PRODUCT_WINDOW_DAYS = 45;

export function normalizeOccasionTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const allowedTags = new Set<string>(MANUAL_OCCASION_TAGS);

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => allowedTags.has(tag))
    )
  );
}

export function getProductDiscoveryTags(product: Pick<Saree, "occasionTags" | "price" | "createdAt">, now = new Date()) {
  const tags = new Set<string>(normalizeOccasionTags(product.occasionTags));

  if (isNewArrival(product.createdAt, now)) {
    tags.add("New");
  }

  if (product.price <= 2000) {
    tags.add("Under ₹2,000");
  }

  return Array.from(tags);
}

export function matchesProductIntent(product: Pick<Saree, "occasionTags" | "price" | "createdAt">, intent: string) {
  const normalizedIntent = intent.trim().toLowerCase();

  return getProductDiscoveryTags(product).some((tag) => tag.toLowerCase() === normalizedIntent);
}

export function matchesProductSearch(
  product: Pick<Saree, "name" | "category" | "fabric" | "color" | "collectionLabel" | "description" | "occasionTags" | "price" | "createdAt">,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    product.name,
    product.category,
    product.fabric,
    product.color,
    product.collectionLabel,
    product.description,
    ...getProductDiscoveryTags(product)
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export function formatOccasionSummary(tags?: string[] | null) {
  const normalizedTags = normalizeOccasionTags(tags);

  return normalizedTags.length > 0 ? normalizedTags.join(" · ") : "No occasion tags selected";
}

function isNewArrival(value: unknown, now: Date) {
  const createdAt = getTimestampValue(value);

  if (!createdAt) {
    return false;
  }

  const msSinceCreated = now.getTime() - createdAt;
  const newWindowMs = NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return msSinceCreated >= 0 && msSinceCreated <= newWindowMs;
}

function getTimestampValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}
