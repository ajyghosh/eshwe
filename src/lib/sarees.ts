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

import { postJson } from "@/lib/api";
import { optimizedImageUrl } from "@/lib/image-assets";

import { db } from "@/lib/firebase";
import { getEffectiveAvailabilityStatus, normalizeAvailableStock } from "@/lib/inventory";
import { normalizeOccasionTags } from "@/lib/product-discovery";
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
  onError?: (error: Error) => void,
  onFreshness?: (fresh: boolean) => void
) {
  if (!db) {
    onError?.(new Error("The catalogue is unavailable. Please check the site configuration."));
    onFreshness?.(false);
    return () => undefined;
  }

  const constraints = buildConstraints(options);

  if (options.max) {
    constraints.push(limit(options.max));
  }

  const sareesQuery = query(collection(db, COLLECTION_NAME), ...constraints);

  return onSnapshot(
    sareesQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      onFreshness?.(!snapshot.metadata.fromCache);
      if (snapshot.metadata.fromCache && snapshot.empty) return;
      onData(
        snapshot.docs.map((productDoc) => hydrateSaree(productDoc.id, productDoc.data()))
      );
    },
    (error) => {
      onFreshness?.(false);
      onError?.(error);
    }
  );
}

function hydrateSaree(id: string, data: Record<string, unknown>) {
  const availableStock = normalizeAvailableStock(data.availableStock);
  const status = getEffectiveAvailabilityStatus((data.status as SareeStatus) || "active", availableStock);
  const occasionTags = normalizeOccasionTags(data.occasionTags as string[] | null | undefined);

  return {
    id,
    ...data,
    primaryImageUrl: typeof data.primaryImageUrl === "string" ? optimizedImageUrl(data.primaryImageUrl) : "",
    galleryImageUrls: Array.isArray(data.galleryImageUrls) ? data.galleryImageUrls.map(value => typeof value === "string" ? optimizedImageUrl(value) : value) : [],
    occasionTags,
    publicationStatus: (data.status as SareeStatus) || "draft",
    reservedStock: normalizeAvailableStock(data.reservedStock),
    version: (data.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? null,
    availableStock,
    status
  } as Saree;
}

export async function createSaree(saree: Omit<Saree, "id" | "createdAt" | "updatedAt">) {
  return postJson<{ id: string }>("/api/owner/product", { changes: saree });
}

export async function updateSaree(id: string, updates: Partial<Omit<Saree, "id" | "createdAt">>, expectedVersion?: number | null) {
  return postJson<{ id: string }>("/api/owner/product", { id, changes: updates, expectedVersion });
}

export async function archiveSaree(id: string, expectedVersion?: number | null) {
  return updateSaree(id, { status: "draft" }, expectedVersion);
}

export async function deleteSaree(id: string, expectedVersion?: number | null) {
  return postJson<{ id: string; deleted: boolean }>("/api/owner/product", { action: "delete", id, expectedVersion });
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
