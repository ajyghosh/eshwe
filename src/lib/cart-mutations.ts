import { normalizeCart } from "@/lib/cart-state";
import type { CartItem } from "@/types/cart";

export type CartMutation = {
  removed: string[];
  changes: { item: CartItem; delta: number }[];
};

const identity = (item: CartItem) => item.productId || item.sku;

// Store user quantity changes, not a whole bag snapshot that could overwrite
// another device's additions. Removal only affects the selected products.
export function createCartMutation(before: CartItem[], after: CartItem[]): CartMutation {
  const previous = new Map(before.map(item => [identity(item), item]));
  const next = normalizeCart(after);
  return {
    removed: before.filter(item => !next.some(value => identity(value) === identity(item))).map(identity),
    changes: next.flatMap(item => {
      const delta = item.quantity - (previous.get(identity(item))?.quantity || 0);
      return delta ? [{ item, delta }] : [];
    })
  };
}

export function applyCartMutation(items: CartItem[], mutation: CartMutation): CartItem[] {
  const result = items.filter(item => !mutation.removed.includes(identity(item)));
  for (const { item, delta } of mutation.changes) {
    const index = result.findIndex(value => identity(value) === identity(item));
    const quantity = Math.min(10, Math.max(0, (index < 0 ? 0 : result[index].quantity) + delta));
    if (index >= 0) {
      if (quantity) result[index] = { ...result[index], quantity };
      else result.splice(index, 1);
    } else if (quantity) result.push({ ...item, quantity });
  }
  return result;
}
