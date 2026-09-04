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

  if (documents.length === 0) {
    console.log("No sarees found.");
    return;
  }

  let updated = 0;

  for (const document of documents) {
    await patchDocument(accessToken, document.name, {
      fields: {
        price: {
          integerValue: "1"
        }
      }
    });

    updated += 1;
  }

  console.log(`Updated ${updated} saree price${updated === 1 ? "" : "s"} to INR 1.`);
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

async function patchDocument(accessToken, documentName, body) {
  const url = new URL(`https://firestore.googleapis.com/v1/${documentName}`);
  url.searchParams.append("updateMask.fieldPaths", "price");

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
