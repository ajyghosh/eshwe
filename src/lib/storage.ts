import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

import { storage } from "@/lib/firebase";

const STORAGE_ROOT = "sarees";
const IMMUTABLE_CACHE_CONTROL = "public,max-age=31536000,immutable";
const PRODUCT_IMAGE_PRESET = {
  maxDimension: 1600,
  quality: 0.82,
  targetType: "image/webp"
} as const;
const SITE_ASSET_PRESET = {
  maxDimension: 1800,
  quality: 0.84,
  targetType: "image/webp"
} as const;

export function getSareeImagePath(sku: string, fileName: string) {
  return `${STORAGE_ROOT}/${sanitizeSegment(sku)}/${Date.now()}-${sanitizeSegment(fileName)}`;
}

export async function uploadSareeImage(file: File, sku: string) {
  const optimizedFile = await optimizeImageFile(file, PRODUCT_IMAGE_PRESET);
  return uploadStorageFile(optimizedFile, getSareeImagePath(sku, optimizedFile.name));
}

export function getSiteAssetPath(folder: string, fileName: string) {
  return `${sanitizeFolder(folder)}/${Date.now()}-${sanitizeSegment(fileName)}`;
}

export async function uploadSiteAsset(file: File, folder: string) {
  const optimizedFile = await optimizeImageFile(file, SITE_ASSET_PRESET);
  return uploadStorageFile(optimizedFile, getSiteAssetPath(folder, optimizedFile.name));
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
    contentType: file.type || "application/octet-stream",
    cacheControl: IMMUTABLE_CACHE_CONTROL
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    path: snapshot.ref.fullPath,
    url: downloadUrl
  };
}

async function optimizeImageFile(
  file: File,
  options: {
    maxDimension: number;
    quality: number;
    targetType: "image/webp";
  }
) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  const image = await loadImageElement(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > options.maxDimension ? options.maxDimension / largestSide : 1;
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, options.targetType, options.quality);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], replaceFileExtension(file.name, extensionForMimeType(blob.type) ?? "webp"), {
    type: blob.type,
    lastModified: file.lastModified
  });
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image ${file.name}.`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const sanitizedExtension = nextExtension.replace(/^\./, "");
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.${sanitizedExtension}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  return null;
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
