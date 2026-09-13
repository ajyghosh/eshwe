import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(Boolean);
}

const app = hasFirebaseConfig()
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export { app };
export const firebaseReady = Boolean(app);
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const auth = app ? getAuth(app) : null;

// Explicit test configuration only; production uses the normal Firebase services.
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST && app) {
  const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST.split(":");
  try { if (db) connectFirestoreEmulator(db, host, Number(port)); } catch { /* Hot reload already connected. */ }
  try { if (auth) connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL || `http://${host}:9099`, { disableWarnings: true }); } catch { /* Hot reload already connected. */ }
}
