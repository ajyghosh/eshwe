import { readFile } from "node:fs/promises";

const PROJECT_ID = "eshwesareestudio";
const FIREBASE_CONFIG_PATH = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
const ENV_PATH = new URL("../.env.local", import.meta.url);
const shouldDelete = process.argv.includes("--delete");

const STORAGE_PREFIXES = ["sarees/", "categories/", "site-content/"];
const FIRESTORE_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;

async function main() {
  const [accessToken, envConfig] = await Promise.all([getFirebaseAccessToken(), readEnvConfig()]);
  const bucket = envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing from .env.local.");
  }

  const referencedPaths = await collectReferencedPaths(accessToken, bucket);
  const allPaths = await listStorageObjects(accessToken, bucket, STORAGE_PREFIXES);
  const unusedPaths = allPaths.filter((path) => !referencedPaths.has(path));

  if (shouldDelete) {
    for (const path of unusedPaths) {
      await deleteStorageObject(accessToken, bucket, path);
    }
  }

  const summary = {
    mode: shouldDelete ? "delete" : "dry-run",
    bucket,
    referencedCount: referencedPaths.size,
    scannedCount: allPaths.length,
    unusedCount: unusedPaths.length,
    unusedPaths: unusedPaths.slice(0, 200)
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function collectReferencedPaths(accessToken, bucket) {
  const referencedPaths = new Set();
  await walkCollections(accessToken, FIRESTORE_ROOT, referencedPaths, bucket);
  return referencedPaths;
}

async function walkCollections(accessToken, parentPath, referencedPaths, bucket) {
  const collectionIds = await listCollectionIds(accessToken, parentPath);

  for (const collectionId of collectionIds) {
    const documents = await listFirestoreDocuments(accessToken, `${parentPath}/${collectionId}`);

    for (const document of documents) {
      collectPathsFromValue(document?.fields, referencedPaths, bucket);
      await walkCollections(accessToken, document.name, referencedPaths, bucket);
    }
  }
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

async function listCollectionIds(accessToken, parentPath) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${parentPath}:listCollectionIds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pageSize: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to list Firestore collection ids for ${parentPath}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return (payload.collectionIds ?? []).map((value) => String(value).trim()).filter(Boolean).sort();
}

async function readFirestoreDocument(accessToken, documentPath) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${documentPath}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read Firestore document ${documentPath}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function listFirestoreDocuments(accessToken, collectionPath) {
  const documents = [];
  let pageToken = "";

  do {
    const url = new URL(`https://firestore.googleapis.com/v1/${collectionPath}`);
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

async function listStorageObjects(accessToken, bucket, prefixes) {
  const allPaths = [];

  for (const prefix of prefixes) {
    let pageToken = "";

    do {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`);
      url.searchParams.set("prefix", prefix);
      url.searchParams.set("maxResults", "1000");

      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list storage objects for ${prefix}: ${response.status} ${await response.text()}`);
      }

      const payload = await response.json();
      allPaths.push(...(payload.items ?? []).map((item) => String(item.name ?? "").trim()).filter(Boolean));
      pageToken = payload.nextPageToken ?? "";
    } while (pageToken);
  }

  return Array.from(new Set(allPaths)).sort();
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

function collectPathsFromValue(value, referencedPaths, bucket) {
  if (!value || typeof value !== "object") {
    return;
  }

  if ("stringValue" in value) {
    const path = extractStoragePath(String(value.stringValue ?? "").trim(), bucket);
    if (path) {
      referencedPaths.add(path);
    }
    return;
  }

  if ("mapValue" in value) {
    const fields = value.mapValue?.fields ?? {};
    for (const entry of Object.values(fields)) {
      collectPathsFromValue(entry, referencedPaths, bucket);
    }
    return;
  }

  if ("arrayValue" in value) {
    for (const entry of value.arrayValue?.values ?? []) {
      collectPathsFromValue(entry, referencedPaths, bucket);
    }
    return;
  }

  for (const entry of Object.values(value)) {
    collectPathsFromValue(entry, referencedPaths, bucket);
  }
}

function extractStoragePath(rawValue, bucket) {
  if (!rawValue) {
    return "";
  }

  const directPath = STORAGE_PREFIXES.find((prefix) => rawValue.startsWith(prefix));
  if (directPath) {
    return rawValue;
  }

  if (rawValue.startsWith(`gs://${bucket}/`)) {
    return rawValue.slice(`gs://${bucket}/`.length);
  }

  try {
    const url = new URL(rawValue);
    const storageApiMatch = url.pathname.match(/\/o\/(.+)$/);

    if (storageApiMatch && isKnownStorageHost(url.hostname)) {
      const decoded = decodeURIComponent(storageApiMatch[1]);
      if (decoded && STORAGE_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
        return decoded;
      }
    }

    const bucketMatch = url.pathname.match(/\/b\/([^/]+)\/o\/(.+)$/);
    if (bucketMatch && bucketMatch[1] === bucket && isKnownStorageHost(url.hostname)) {
      const decoded = decodeURIComponent(bucketMatch[2]);
      if (decoded && STORAGE_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
        return decoded;
      }
    }
  } catch {
    return "";
  }

  return "";
}

function isKnownStorageHost(hostname) {
  return hostname === "firebasestorage.googleapis.com" || hostname === "storage.googleapis.com";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
