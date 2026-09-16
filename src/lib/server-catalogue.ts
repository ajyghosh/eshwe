import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { optimizedImageUrl } from "@/lib/image-assets";

export type PublishedProduct = { id: string; slug: string; name: string; description?: string; primaryImageUrl?: string; sku: string; price: number; status: string; availableStock?: number; updatedAt?: string; createdAt?: string; featured?: boolean };
export function publishedCatalogue(): PublishedProduct[] {
  const products: PublishedProduct[] = JSON.parse(readFileSync(resolve(process.env.ESHWE_CATALOGUE_SNAPSHOT || ".catalogue-build/products.json"), "utf8"));
  return products.map(product => ({ ...product, primaryImageUrl: product.primaryImageUrl ? optimizedImageUrl(product.primaryImageUrl) : product.primaryImageUrl }));
}
