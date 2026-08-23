import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
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
