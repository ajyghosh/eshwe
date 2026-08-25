import type { CartItem } from "@/types/cart";
import type { Saree, SareeStatus } from "@/types/saree";

export const MAX_CART_ITEM_QUANTITY = 10;
export const DEFAULT_AVAILABLE_STOCK = 10;

export function normalizeAvailableStock(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AVAILABLE_STOCK;
  }

  return Math.max(0, Math.floor(value));
}

export function getEffectiveAvailabilityStatus(status: SareeStatus, availableStock: number): SareeStatus {
  if (status === "draft") {
    return "draft";
  }

  if (availableStock <= 0) {
    return "out_of_stock";
  }

  return status === "out_of_stock" ? "out_of_stock" : "active";
}

export function getPurchasableQuantityLimit(availableStock: number) {
  return Math.min(MAX_CART_ITEM_QUANTITY, normalizeAvailableStock(availableStock));
}

export function clampCartQuantityToStock(quantity: number, availableStock: number) {
  const normalizedQuantity = Math.max(1, Math.floor(quantity));
  const purchasableLimit = getPurchasableQuantityLimit(availableStock);

  if (purchasableLimit <= 0) {
    return normalizedQuantity;
  }

  return Math.min(normalizedQuantity, purchasableLimit);
}

export function isProductPurchasable(product: Pick<Saree, "status" | "availableStock">) {
  const availableStock = normalizeAvailableStock(product.availableStock);
  return product.status === "active" && availableStock > 0;
}

export function isCartItemUnavailable(item: Pick<CartItem, "status" | "availableStock">) {
  return item.status !== "active" || normalizeAvailableStock(item.availableStock) <= 0;
}
