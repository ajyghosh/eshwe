import { clampCartQuantityToStock, getEffectiveAvailabilityStatus, normalizeAvailableStock } from "@/lib/inventory";
import type { CartItem } from "@/types/cart";
import type { Saree } from "@/types/saree";

export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CartItem => Boolean(item && typeof item.sku === "string" && typeof item.name === "string" && typeof item.slug === "string" && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0)).map(item => ({ ...item, quantity: Math.min(10,item.quantity), availableStock: normalizeAvailableStock(item.availableStock), reservedStock: normalizeAvailableStock(item.reservedStock) }));
}

export function mergeCartSnapshots(account: CartItem[], guest: CartItem[]) {
  const items: CartItem[] = [];
  for (const item of [...account, ...guest]) {
    const previous = items.find(entry => entry.productId && item.productId ? entry.productId === item.productId : entry.sku === item.sku);
    if (previous) {
      previous.quantity = Math.max(previous.quantity, item.quantity);
      previous.productId ||= item.productId;
    } else items.push({ ...item });
  }
  return items;
}

export function syncCartItemsWithCatalogue(items: CartItem[], products: Saree[]) {
  const ids = new Map(products.filter(p=>p.id).map(p=>[p.id,p]));
  const skus = new Map(products.map(p=>[p.sku,p]));
  return items.map(item => {
    const product = item.productId ? ids.get(item.productId) : skus.get(item.sku);
    if (!product) return { ...item, availableStock: 0, reservedStock: 0, status: "out_of_stock" as const };
    return { ...item, productId: product.id, sku: product.sku, slug: product.slug, name: product.name, price: product.price, originalPrice: product.originalPrice ?? null, primaryImageUrl: product.primaryImageUrl, fabric: product.fabric, color: product.color, availableStock: product.availableStock, reservedStock: product.reservedStock ?? 0, status: getEffectiveAvailabilityStatus(product.status,product.availableStock), quantity: product.availableStock > 0 ? clampCartQuantityToStock(item.quantity,product.availableStock) : item.quantity };
  });
}
