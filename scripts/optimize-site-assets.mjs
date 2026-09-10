import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const PROJECT_ID = "eshwesareestudio";
const FIREBASE_CONFIG_PATH = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
const ENV_PATH = new URL("../.env.local", import.meta.url);
const HOMEPAGE_DOCUMENT_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/siteContent/homepage`;
const CATEGORY_COLLECTION_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/categoryCards`;
const SITE_MAX_DIMENSION = 1800;
const SITE_WEBP_QUALITY = 84;

async function main() {
  const [accessToken, envConfig] = await Promise.all([getFirebaseAccessToken(), readEnvConfig()]);
  const bucket = envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing from .env.local.");
  }

  const replacements = new Map();
  let updatedDocuments = 0;

  const homepageDocument = await readFirestoreDocument(accessToken, HOMEPAGE_DOCUMENT_PATH);
  const homepageFields = homepageDocument.fields ?? {};

  const nextHero = await maybeOptimizeEntry(
    accessToken,
    bucket,
    getStringField(homepageDocument, "heroImagePath"),
    getStringField(homepageDocument, "heroImageUrl"),
    replacements
  );
  const nextLaunch = await maybeOptimizeEntry(
    accessToken,
    bucket,
    getStringField(homepageDocument, "launchImagePath"),
    getStringField(homepageDocument, "launchImageUrl"),
    replacements
  );
  const nextSlides = await Promise.all(
    getArrayField(homepageDocument, "mobileHeroSlides").map(async (entry) => {
      const imagePath = getMapStringField(entry, "imagePath");
      const imageUrl = getMapStringField(entry, "imageUrl");
      const replacement = await maybeOptimizeEntry(accessToken, bucket, imagePath, imageUrl, replacements);

      return {
        imageAlt: getMapStringField(entry, "imageAlt"),
        imagePath: replacement?.path || imagePath,
        imageUrl: replacement?.url || imageUrl,
        position: getMapStringField(entry, "position")
      };
    })
  );

  const homepageNeedsUpdate =
    Boolean(nextHero) ||
    Boolean(nextLaunch) ||
    nextSlides.some((slide, index) => {
      const currentEntry = getArrayField(homepageDocument, "mobileHeroSlides")[index];
      return (
        slide.imagePath !== getMapStringField(currentEntry, "imagePath") ||
        slide.imageUrl !== getMapStringField(currentEntry, "imageUrl")
      );
    });

  if (homepageNeedsUpdate) {
    await patchFirestoreDocument(
      accessToken,
      homepageDocument.name,
      {
        fields: {
          ...homepageFields,
          ...(nextHero
            ? {
                heroImagePath: { stringValue: nextHero.path },
                heroImageUrl: { stringValue: nextHero.url }
              }
            : {}),
          ...(nextLaunch
            ? {
                launchImagePath: { stringValue: nextLaunch.path },
                launchImageUrl: { stringValue: nextLaunch.url }
              }
            : {}),
          mobileHeroSlides: buildSlideArrayField(nextSlides)
        }
      },
      [
        ...(nextHero ? ["heroImagePath", "heroImageUrl"] : []),
        ...(nextLaunch ? ["launchImagePath", "launchImageUrl"] : []),
        "mobileHeroSlides"
      ]
    );
    updatedDocuments += 1;
  }

  const categoryDocuments = await listFirestoreDocuments(accessToken, CATEGORY_COLLECTION_PATH);

  for (const document of categoryDocuments) {
    const nextImage = await maybeOptimizeEntry(
      accessToken,
      bucket,
      getStringField(document, "imagePath"),
      getStringField(document, "imageUrl"),
      replacements
    );

    if (!nextImage) {
      continue;
    }

    await patchFirestoreDocument(
      accessToken,
      document.name,
      {
        fields: {
          imagePath: { stringValue: nextImage.path },
          imageUrl: { stringValue: nextImage.url }
        }
      },
      ["imagePath", "imageUrl"]
    );
    updatedDocuments += 1;
  }

  console.log(
    `Optimized ${replacements.size} site asset${replacements.size === 1 ? "" : "s"} and updated ${updatedDocuments} Firestore document${updatedDocuments === 1 ? "" : "s"}.`
  );
}

async function maybeOptimizeEntry(accessToken, bucket, originalPath, originalUrl, replacements) {
  const path = normalizeStoragePath(originalPath, originalUrl);

  if (!path || path.endsWith("-optimized.webp")) {
    return null;
  }

  if (replacements.has(path)) {
    return replacements.get(path);
  }

  const fileBuffer = await downloadStorageObject(accessToken, bucket, path);
  const transformed = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: SITE_MAX_DIMENSION,
      height: SITE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: SITE_WEBP_QUALITY })
    .toBuffer();

  const nextPath = buildOptimizedPath(path);
  const downloadToken = randomUUID();
  await uploadStorageObject(accessToken, bucket, nextPath, transformed, downloadToken);

  const replacement = {
    path: nextPath,
    url: buildDownloadUrl(bucket, nextPath, downloadToken)
  };

  replacements.set(path, replacement);
  return replacement;
}

function normalizeStoragePath(pathValue, urlValue) {
  const directPath = typeof pathValue === "string" ? pathValue.trim() : "";

  if (directPath) {
    return directPath;
  }

  return deriveStoragePathFromUrl(typeof urlValue === "string" ? urlValue.trim() : "");
}

function buildOptimizedPath(originalPath) {
  return `${originalPath.replace(/\.[^.]+$/, "")}-optimized.webp`;
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

async function downloadStorageObject(accessToken, bucket, objectPath) {
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`, {
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

function getStringField(document, key) {
  return String(document?.fields?.[key]?.stringValue ?? "").trim();
}

function getArrayField(document, key) {
  return document?.fields?.[key]?.arrayValue?.values ?? [];
}

function getMapStringField(entry, key) {
  return String(entry?.mapValue?.fields?.[key]?.stringValue ?? "").trim();
}

function buildSlideArrayField(slides) {
  return {
    arrayValue: {
      values: slides.map((slide) => ({
        mapValue: {
          fields: {
            imageAlt: { stringValue: slide.imageAlt ?? "" },
            imagePath: { stringValue: slide.imagePath ?? "" },
            imageUrl: { stringValue: slide.imageUrl ?? "" },
            position: { stringValue: slide.position || "center" }
          }
        }
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
