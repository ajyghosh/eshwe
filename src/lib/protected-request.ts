"use client";

import { auth } from "@/lib/firebase";
import { getAppCheckToken } from "@/lib/app-check";

export async function buildProtectedJsonHeaders() {
  return buildProtectedJsonHeadersForPath();
}

export async function buildProtectedJsonHeadersForPath(targetUrl?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (shouldSkipProtectedHeaders(targetUrl)) {
    return headers;
  }

  const [appCheckToken, authToken] = await Promise.all([getOptionalAppCheckToken(), getOptionalAuthToken()]);

  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

function shouldSkipProtectedHeaders(targetUrl?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (!isLocalhost || !targetUrl) {
    return false;
  }

  try {
    return new URL(targetUrl, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

async function getOptionalAppCheckToken() {
  try {
    return await getAppCheckToken();
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `Security check failed to initialize: ${error.message}`
        : "Security check failed to initialize."
    );
    return null;
  }
}

async function getOptionalAuthToken() {
  if (!auth?.currentUser) {
    return null;
  }

  return auth.currentUser.getIdToken();
}
