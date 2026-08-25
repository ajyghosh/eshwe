"use client";

import { auth } from "@/lib/firebase";
import { getAppCheckToken } from "@/lib/app-check";

export async function buildProtectedJsonHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const [appCheckToken, authToken] = await Promise.all([getOptionalAppCheckToken(), getOptionalAuthToken()]);

  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

async function getOptionalAppCheckToken() {
  try {
    return await getAppCheckToken();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Security check failed to initialize: ${error.message}`
        : "Security check failed to initialize."
    );
  }
}

async function getOptionalAuthToken() {
  if (!auth?.currentUser) {
    return null;
  }

  return auth.currentUser.getIdToken();
}
