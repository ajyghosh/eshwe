import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

import { storage } from "@/lib/firebase";

const STORAGE_ROOT = "sarees";

export function getSareeImagePath(sku: string, fileName: string) {
  return `${STORAGE_ROOT}/${sanitizeSegment(sku)}/${Date.now()}-${sanitizeSegment(fileName)}`;
}

export async function uploadSareeImage(file: File, sku: string) {
  return uploadStorageFile(file, getSareeImagePath(sku, file.name));
}

export function getSiteAssetPath(folder: string, fileName: string) {
  return `${sanitizeFolder(folder)}/${Date.now()}-${sanitizeSegment(fileName)}`;
}

export async function uploadSiteAsset(file: File, folder: string) {
  return uploadStorageFile(file, getSiteAssetPath(folder, file.name));
}

export async function deleteSareeImage(path: string) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  return deleteObject(ref(storage, path));
}

export async function deleteSareeImages(paths: string[]) {
  await Promise.all(paths.filter(Boolean).map((path) => deleteSareeImage(path)));
}

async function uploadStorageFile(file: File, path: string) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const fileRef = ref(storage, path);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type || "application/octet-stream"
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    path: snapshot.ref.fullPath,
    url: downloadUrl
  };
}

function sanitizeFolder(value: string) {
  return value
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join("/");
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
