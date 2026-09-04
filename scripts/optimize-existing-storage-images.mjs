import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const PROJECT_ID = "eshwesareestudio";
const COLLECTION_NAME = "sarees";
const FIREBASE_CONFIG_PATH = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
const ENV_PATH = new URL("../.env.local", import.meta.url);
const PRODUCT_MAX_DIMENSION = 1600;
const PRODUCT_WEBP_QUALITY = 82;
const shouldDeleteOriginals = process.argv.includes("--delete-originals");

async function main() {
  const [accessToken, envConfig] = await Promise.all([getFirebaseAccessToken(), readEnvConfig()]);
  const bucket = envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing from .env.local.");
  }

  const documents = await listFirestoreDocuments(accessToken, COLLECTION_NAME);
  const replacements = new Map();
  const documentsToUpdate = [];

  for (const document of documents) {
    const data = flattenDocument(document);
    const primaryImagePath = normalizeStoragePath(data.primaryImagePath, data.primaryImageUrl);
    const galleryEntries = normalizeGalleryEntries(data.galleryImagePaths, data.galleryImageUrls);
    const nextPrimary = primaryImagePath ? await getReplacementForPath(accessToken, bucket, primaryImagePath, replacements) : null;
    const nextGallery = await Promise.all(
      galleryEntries.map(async (entry) => {
        const replacement = entry.path
          ? await getReplacementForPath(accessToken, bucket, entry.path, replacements)
          : null;

        return replacement
          ? {
              path: replacement.path,
              url: replacement.url
            }
          : entry;
      })
    );

    if (
      !nextPrimary &&
      nextGallery.length === galleryEntries.length &&
      nextGallery.every((entry, index) => entry.path === galleryEntries[index]?.path && entry.url === galleryEntries[index]?.url)
    ) {
      continue;
    }

    documentsToUpdate.push({
      name: document.name,
      nextPrimary,
      nextGallery
    });
  }

  for (const entry of documentsToUpdate) {
    await patchFirestoreDocument(accessToken, entry.name, {
      fields: {
        ...(entry.nextPrimary
          ? {
              primaryImagePath: { stringValue: entry.nextPrimary.path },
              primaryImageUrl: { stringValue: entry.nextPrimary.url }
            }
          : {}),
        galleryImagePaths: buildStringArrayField(entry.nextGallery.map((item) => item.path)),
        galleryImageUrls: buildStringArrayField(entry.nextGallery.map((item) => item.url))
      }
    }, [
      ...(entry.nextPrimary ? ["primaryImagePath", "primaryImageUrl"] : []),
      "galleryImagePaths",
      "galleryImageUrls"
    ]);
  }

  if (shouldDeleteOriginals) {
    for (const replacement of replacements.values()) {
      if (!replacement) {
        continue;
      }

      await deleteStorageObject(accessToken, bucket, replacement.originalPath);
    }
  }

  console.log(
    `Optimized ${replacements.size} storage image${replacements.size === 1 ? "" : "s"} and updated ${documentsToUpdate.length} product record${documentsToUpdate.length === 1 ? "" : "s"}${shouldDeleteOriginals ? ". Replaced originals were deleted." : ". Original files were kept as backup."}`
  );
}

async function getReplacementForPath(accessToken, bucket, originalPath, replacements) {
  if (!originalPath || !originalPath.startsWith("sarees/") || originalPath.endsWith("-optimized.webp")) {
    return null;
  }

  if (replacements.has(originalPath)) {
    return replacements.get(originalPath);
  }

  const fileBuffer = await downloadStorageObject(accessToken, bucket, originalPath);
  const transformed = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: PRODUCT_MAX_DIMENSION,
      height: PRODUCT_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: PRODUCT_WEBP_QUALITY })
    .toBuffer();
  const nextPath = buildOptimizedPath(originalPath);
  const downloadToken = randomUUID();

  await uploadStorageObject(accessToken, bucket, nextPath, transformed, downloadToken);

  const replacement = {
    originalPath,
    path: nextPath,
    url: buildDownloadUrl(bucket, nextPath, downloadToken)
  };

  replacements.set(originalPath, replacement);
  return replacement;
}

function buildOptimizedPath(originalPath) {
  const normalized = originalPath.replace(/\.[^.]+$/, "");
  return `${normalized}-optimized.webp`;
}

async function getFirebaseAccessToken() {
  const raw = await readFile(FIREBASE_CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  const accessToken = config?.tokens?.access_token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Could not find a Firebase CLI access token.");
  }

  return accessToken;
}

async function readEnvConfig() {
  const raw = await readFile(ENV_PATH, "utf8");

  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

async function listFirestoreDocuments(accessToken, collectionName) {
  const documents = [];
  let pageToken = "";

  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}`);
    url.searchParams.set("pageSize", "500");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list Firestore documents: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    documents.push(...(payload.documents ?? []));
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return documents;
}

function flattenDocument(document) {
  const fields = document.fields ?? {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((entry) => decodeFirestoreValue(entry));
  }

  return null;
}

function normalizeStoragePath(pathValue, urlValue) {
  const directPath = typeof pathValue === "string" ? pathValue.trim() : "";

  if (directPath) {
    return directPath;
  }

  return deriveStoragePathFromUrl(typeof urlValue === "string" ? urlValue : "");
}

function normalizeStoragePathArray(pathValues, urlValues) {
  const directPaths = Array.isArray(pathValues) ? pathValues : [];
  const urls = Array.isArray(urlValues) ? urlValues : [];
  const longest = Math.max(directPaths.length, urls.length);

  return Array.from({ length: longest }, (_, index) => {
    const path = typeof directPaths[index] === "string" ? directPaths[index].trim() : "";
    if (path) {
      return path;
    }

    return deriveStoragePathFromUrl(typeof urls[index] === "string" ? urls[index] : "");
  }).filter(Boolean);
}

function normalizeGalleryEntries(pathValues, urlValues) {
  const directPaths = Array.isArray(pathValues) ? pathValues : [];
  const urls = Array.isArray(urlValues) ? urlValues : [];
  const longest = Math.max(directPaths.length, urls.length);

  return Array.from({ length: longest }, (_, index) => {
    const path = typeof directPaths[index] === "string" ? directPaths[index].trim() : "";
    const url = typeof urls[index] === "string" ? urls[index].trim() : "";

    return {
      path: path || deriveStoragePathFromUrl(url),
      url
    };
  });
}

function deriveStoragePathFromUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "firebasestorage.googleapis.com") {
      const objectPath = parsed.pathname.split("/o/")[1] ?? "";
      return decodeURIComponent(objectPath);
    }

    if (parsed.hostname === "storage.googleapis.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      return decodeURIComponent(segments.slice(1).join("/"));
    }
  } catch {
    return "";
  }

  return "";
}

async function downloadStorageObject(accessToken, bucket, objectPath) {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${objectPath}: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadStorageObject(accessToken, bucket, objectPath, buffer, downloadToken) {
  const boundary = `eshwe-${randomUUID()}`;
  const metadata = {
    name: objectPath,
    contentType: "image/webp",
    cacheControl: "public,max-age=31536000,immutable",
    metadata: {
      firebaseStorageDownloadTokens: downloadToken
    }
  };
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: image/webp\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(payload.length)
    },
    body: payload
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${objectPath}: ${response.status} ${await response.text()}`);
  }
}

function buildDownloadUrl(bucket, objectPath, downloadToken) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
}

function buildStringArrayField(values) {
  return {
    arrayValue: {
      values: values.map((value) => ({
        stringValue: value ?? ""
      }))
    }
  };
}

async function patchFirestoreDocument(accessToken, documentName, body, fieldPaths) {
  const url = new URL(`https://firestore.googleapis.com/v1/${documentName}`);
  fieldPaths.forEach((fieldPath) => url.searchParams.append("updateMask.fieldPaths", fieldPath));

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to update ${documentName}: ${response.status} ${await response.text()}`);
  }
}

async function deleteStorageObject(accessToken, bucket, objectPath) {
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete ${objectPath}: ${response.status} ${await response.text()}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
