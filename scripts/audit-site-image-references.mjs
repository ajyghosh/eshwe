import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "eshwesareestudio";
const DATABASE_PATH = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIREBASE_CONFIG_PATH = join(homedir(), ".config", "configstore", "firebase-tools.json");

async function main() {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`
  };

  const [homepageResponse, categoryResponse] = await Promise.all([
    fetch(`${DATABASE_PATH}/siteContent/homepage`, { headers }),
    fetch(`${DATABASE_PATH}/categoryCards?pageSize=100`, { headers })
  ]);

  if (!homepageResponse.ok) {
    throw new Error(`Failed to read homepage document: ${homepageResponse.status} ${await homepageResponse.text()}`);
  }

  if (!categoryResponse.ok) {
    throw new Error(`Failed to read category cards: ${categoryResponse.status} ${await categoryResponse.text()}`);
  }

  const homepage = await homepageResponse.json();
  const categories = await categoryResponse.json();

  const result = {
    homepage: {
      heroImagePath: getStringField(homepage, "heroImagePath"),
      launchImagePath: getStringField(homepage, "launchImagePath"),
      mobileHeroSlides: getArrayField(homepage, "mobileHeroSlides").map((entry) => ({
        imagePath: getMapStringField(entry, "imagePath"),
        imageUrl: getMapStringField(entry, "imageUrl")
      }))
    },
    categoryCards: (categories.documents ?? []).map((document) => ({
      title: getStringField(document, "title"),
      imagePath: getStringField(document, "imagePath"),
      imageUrl: getStringField(document, "imageUrl")
    }))
  };

  console.log(JSON.stringify(result, null, 2));
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

function getStringField(document, key) {
  return String(document?.fields?.[key]?.stringValue ?? "").trim();
}

function getArrayField(document, key) {
  return document?.fields?.[key]?.arrayValue?.values ?? [];
}

function getMapStringField(entry, key) {
  return String(entry?.mapValue?.fields?.[key]?.stringValue ?? "").trim();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
