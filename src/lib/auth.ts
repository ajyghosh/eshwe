import {
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const OWNER_EMAIL = "ajyghosh@gmail.com";
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutCurrentUser() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export async function signInAsOwner() {
  return signInWithGoogle();
}

export async function signOutOwner() {
  await signOutCurrentUser();
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function isPrimaryOwnerEmail(email?: string | null) {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export function isOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() === OWNER_EMAIL;
}

export function getOwnerEmail() {
  return OWNER_EMAIL;
}

export function getCustomerAuthDisplayLabel(user?: Pick<User, "displayName" | "phoneNumber" | "email"> | null) {
  const displayName = user?.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const phoneNumber = user?.phoneNumber?.trim();

  if (phoneNumber) {
    return phoneNumber;
  }

  return user?.email?.trim() ?? "";
}

export async function syncCustomerDisplayName(fullName: string) {
  const normalizedFullName = fullName.trim();

  if (!auth?.currentUser || !normalizedFullName) {
    return;
  }

  if (auth.currentUser.displayName === normalizedFullName) {
    return;
  }

  await updateProfile(auth.currentUser, {
    displayName: normalizedFullName
  });
}
