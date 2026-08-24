"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useAuthSession } from "@/components/auth-provider";
import type { Saree } from "@/types/saree";
import type { CartItem } from "@/types/cart";

const CART_STORAGE_KEY = "eshwe-cart-v1";
const MAX_ITEM_QUANTITY = 10;

type CartContextValue = {
  items: CartItem[];
  isReady: boolean;
  subtotal: number;
  savings: number;
  shippingFee: number;
  packagingFee: number;
  total: number;
  totalItems: number;
  addItem: (product: Saree, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const storageKey = user?.uid ? `${CART_STORAGE_KEY}:${user.uid}` : `${CART_STORAGE_KEY}:guest`;
  const guestStorageKey = `${CART_STORAGE_KEY}:guest`;

  useEffect(() => {
    if (loading || typeof window === "undefined") {
      return;
    }

    setHydratedStorageKey(null);

    try {
      if (user?.uid) {
        const accountCart = readStoredCart(storageKey);
        const guestCart = readStoredCart(guestStorageKey);
        const mergedCart = mergeCartItems(accountCart, guestCart);

        window.localStorage.setItem(storageKey, JSON.stringify(mergedCart));

        if (guestCart.length > 0) {
          window.localStorage.removeItem(guestStorageKey);
        }

        setItems(mergedCart);
      } else {
        setItems(readStoredCart(storageKey));
      }
    } catch {
      window.localStorage.removeItem(storageKey);

      if (storageKey !== guestStorageKey) {
        window.localStorage.removeItem(guestStorageKey);
      }

      setItems([]);
    } finally {
      setHydratedStorageKey(storageKey);
    }
  }, [guestStorageKey, loading, storageKey, user?.uid]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydratedStorageKey, items, storageKey]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const savings = items.reduce((sum, item) => {
      const originalPrice = typeof item.originalPrice === "number" ? item.originalPrice : item.price;
      return sum + Math.max(originalPrice - item.price, 0) * item.quantity;
    }, 0);
    const shippingFee = 0;
    const packagingFee = 0;
    const total = subtotal + shippingFee + packagingFee;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      isReady: hydratedStorageKey === storageKey,
      subtotal,
      savings,
      shippingFee,
      packagingFee,
      total,
      totalItems,
      addItem(product, quantity = 1) {
        if (product.status !== "active") {
          return;
        }

        setItems((currentItems) => {
          const safeQuantity = normalizeQuantity(quantity);
          const existingItem = currentItems.find((item) => item.sku === product.sku);

          if (existingItem) {
            return currentItems.map((item) =>
              item.sku === product.sku
                ? {
                    ...item,
                    quantity: clampQuantity(item.quantity + safeQuantity)
                  }
                : item
            );
          }

          return [
            ...currentItems,
            {
              sku: product.sku,
              slug: product.slug,
              name: product.name,
              price: product.price,
              originalPrice: product.originalPrice,
              primaryImageUrl: product.primaryImageUrl,
              fabric: product.fabric,
              color: product.color,
              status: product.status,
              quantity: clampQuantity(safeQuantity)
            }
          ];
        });
      },
      updateQuantity(sku, quantity) {
        const safeQuantity = Math.max(0, Math.floor(quantity));

        setItems((currentItems) => {
          if (safeQuantity === 0) {
            return currentItems.filter((item) => item.sku !== sku);
          }

          return currentItems.map((item) =>
            item.sku === sku
              ? {
                  ...item,
                  quantity: clampQuantity(safeQuantity)
                }
              : item
          );
        });
      },
      removeItem(sku) {
        setItems((currentItems) => currentItems.filter((item) => item.sku !== sku));
      },
      clearCart() {
        setItems([]);
      }
    };
  }, [hydratedStorageKey, items, storageKey]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}

function normalizeQuantity(value: number) {
  return Math.max(1, Math.floor(value));
}

function clampQuantity(value: number) {
  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(value)));
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CartItem>;

  return (
    typeof item.sku === "string" &&
    typeof item.slug === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.primaryImageUrl === "string" &&
    typeof item.fabric === "string" &&
    typeof item.color === "string" &&
    typeof item.quantity === "number"
  );
}

function readStoredCart(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const savedCart = window.localStorage.getItem(storageKey);

  if (!savedCart) {
    return [];
  }

  const parsedItems = JSON.parse(savedCart) as CartItem[];
  return Array.isArray(parsedItems) ? parsedItems.filter(isCartItem) : [];
}

function mergeCartItems(primaryItems: CartItem[], secondaryItems: CartItem[]) {
  const mergedItems = new Map<string, CartItem>();

  primaryItems.forEach((item) => {
    mergedItems.set(item.sku, item);
  });

  secondaryItems.forEach((item) => {
    const existingItem = mergedItems.get(item.sku);

    if (!existingItem) {
      mergedItems.set(item.sku, item);
      return;
    }

    mergedItems.set(item.sku, {
      ...existingItem,
      quantity: clampQuantity(existingItem.quantity + item.quantity)
    });
  });

  return Array.from(mergedItems.values());
}
