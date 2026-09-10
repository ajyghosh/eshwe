import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "eshwesareestudio";
const DATABASE_PATH = `projects/${PROJECT_ID}/databases/(default)`;
const COLLECTION_PATH = `${DATABASE_PATH}/documents/sarees`;
const FIREBASE_CONFIG_PATH = join(homedir(), ".config", "configstore", "firebase-tools.json");

async function main() {
  const accessToken = await getAccessToken();
  const documents = await listSareeDocuments(accessToken);
  const dummyProducts = documents.filter((document) => {
    const sku = getStringField(document, "sku");
    const name = getStringField(document, "name");
    return sku.startsWith("DUMMY-") && name.includes("Test Saree");
  });

  if (dummyProducts.length === 0) {
    console.log("No dummy saree names needed updating.");
    return;
  }

  let updated = 0;

  for (const document of dummyProducts) {
    const color = getStringField(document, "color");
    const category = getStringField(document, "category");
    const sku = getStringField(document, "sku");
    const sequence = sku.split("-").at(-1) ?? "001";
    const nextName = `${color} ${category} ${sequence}`.replace(/\s+/g, " ").trim();
    const currentName = getStringField(document, "name");

    if (!nextName || nextName === currentName) {
      continue;
    }

    await patchDocument(accessToken, document.name, {
      fields: {
        name: {
          stringValue: nextName
        }
      }
    });
    updated += 1;
  }

  console.log(`Updated ${updated} dummy saree name${updated === 1 ? "" : "s"}.`);
}

async function getAccessToken() {
  const raw = await readFile(FIREBASE_CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  const accessToken = config?.tokens?.access_token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Could not find a Firebase CLI access token.");
  }

  return accessToken;
}

async function listSareeDocuments(accessToken) {
  const documents = [];
  let pageToken = "";

  do {
    const url = new URL(`https://firestore.googleapis.com/v1/${COLLECTION_PATH}`);
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
      throw new Error(`Failed to list sarees: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    documents.push(...(payload.documents ?? []));
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return documents;
}

function getStringField(document, key) {
  return String(document?.fields?.[key]?.stringValue ?? "").trim();
}

async function patchDocument(accessToken, documentName, body) {
  const url = new URL(`https://firestore.googleapis.com/v1/${documentName}`);
  url.searchParams.set("updateMask.fieldPaths", "name");

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
