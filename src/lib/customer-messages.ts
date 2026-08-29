import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CustomerMessage } from "@/types/customer-message";

const CUSTOMER_MESSAGES_COLLECTION = "customerMessages";

export async function createCustomerMessage(
  message: Pick<CustomerMessage, "email" | "phone" | "message" | "sourcePath">
) {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return addDoc(collection(db, CUSTOMER_MESSAGES_COLLECTION), {
    email: message.email.trim(),
    phone: message.phone.trim(),
    message: message.message.trim(),
    sourcePath: message.sourcePath.trim() || "/",
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateCustomerMessageStatus(messageId: string, status: "new" | "read") {
  if (!db) {
    throw new Error("Firestore is not available.");
  }

  const messageRef = doc(db, CUSTOMER_MESSAGES_COLLECTION, messageId);

  await updateDoc(messageRef, {
    readAt: status === "read" ? serverTimestamp() : null,
    status,
    updatedAt: serverTimestamp()
  });
}

export function subscribeToCustomerMessages(
  onData: (messages: CustomerMessage[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const messagesQuery = query(
    collection(db, CUSTOMER_MESSAGES_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data()
        })) as CustomerMessage[]
      );
    },
    (error) => {
      onData([]);
      onError?.(error);
    }
  );
}

export function isUnreadCustomerMessage(message: Pick<CustomerMessage, "status">) {
  return message.status !== "read";
}

export function getUnreadCustomerMessageCount(messages: Pick<CustomerMessage, "status">[]) {
  return messages.filter(isUnreadCustomerMessage).length;
}
