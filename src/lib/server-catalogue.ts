import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PublishedProduct = { id: string; slug: string; name: string; description?: string; primaryImageUrl?: string; sku: string; price: number; status: string; availableStock?: number; updatedAt?: string };
export function publishedCatalogue(): PublishedProduct[] {
  return JSON.parse(readFileSync(resolve(process.env.ESHWE_CATALOGUE_SNAPSHOT || ".catalogue-build/products.json"), "utf8"));
}
