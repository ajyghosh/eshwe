import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { isProductPurchasable } from "@/lib/inventory";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

const ORDER_COLLECTION = "checkoutOrders";

export function buildReorderSelections(order: CheckoutOrder, catalogueProducts: Saree[]) {
  const productsBySku = new Map(catalogueProducts.map((product) => [product.sku, product]));

  return (order.cartItems ?? []).flatMap((item) => {
    const product = productsBySku.get(item.sku);

    if (!product || !isProductPurchasable(product)) {
      return [];
    }

    return [
      {
        product,
        quantity: Math.max(1, Math.floor(item.quantity) || 1)
      }
    ];
  });
}

export function subscribeToCustomerOrders(
  userId: string,
  onData: (orders: CheckoutOrder[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const ordersQuery = query(collection(db, ORDER_COLLECTION), where("userId", "==", userId), limit(100));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs
        .map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data()
        }) as CheckoutOrder)
        .sort((left, right) => getTimestampValue(right.createdAt) - getTimestampValue(left.createdAt));

      onData(orders);
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export function subscribeToSuccessfulOrders(
  onData: (orders: CheckoutOrder[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const ordersQuery = query(collection(db, ORDER_COLLECTION), orderBy("createdAt", "desc"), limit(100));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs
        .map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data()
        }))
        .filter(isSuccessfulOrder)
        .sort(compareOwnerOrders) as CheckoutOrder[];

      onData(orders);
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export async function updateOrderDispatchStatus(orderId: string, dispatchStatus: "completed" | "new") {
  if (!db) {
    throw new Error("Firestore is not available.");
  }

  const orderRef = doc(db, ORDER_COLLECTION, orderId);

  await updateDoc(orderRef, {
    completedAt: dispatchStatus === "completed" ? serverTimestamp() : null,
    dispatchStatus,
    updatedAt: serverTimestamp()
  });
}

export function getPendingDispatchCount(orders: Pick<CheckoutOrder, "dispatchStatus">[]) {
  return orders.filter((order) => order.dispatchStatus !== "completed").length;
}

function isSuccessfulOrder(order: Partial<CheckoutOrder>) {
  return (
    order.paymentStatus === "captured" ||
    order.status === "paid" ||
    order.paymentCaptured === true
  );
}

function compareOwnerOrders(left: CheckoutOrder, right: CheckoutOrder) {
  const leftCompleted = left.dispatchStatus === "completed";
  const rightCompleted = right.dispatchStatus === "completed";

  if (leftCompleted !== rightCompleted) {
    return leftCompleted ? 1 : -1;
  }

  return getTimestampValue(right.createdAt) - getTimestampValue(left.createdAt);
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
