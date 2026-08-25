"use client";

import { app } from "@/lib/firebase";

const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim() ?? "";

let appCheckInstancePromise: Promise<import("firebase/app-check").AppCheck | null> | null = null;

export function isAppCheckConfigured() {
  return Boolean(app && appCheckSiteKey);
}

export async function getAppCheckToken() {
  const appCheck = await getAppCheckInstance();

  if (!appCheck) {
    return null;
  }

  const { getToken } = await import("firebase/app-check");
  const tokenResult = await getToken(appCheck, false);
  return tokenResult.token;
}

async function getAppCheckInstance() {
  if (!app || !appCheckSiteKey || typeof window === "undefined") {
    return null;
  }

  const firebaseApp = app;

  if (!appCheckInstancePromise) {
    appCheckInstancePromise = import("firebase/app-check").then(
      ({ ReCaptchaV3Provider, initializeAppCheck }) =>
        initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        })
    );
  }

  return appCheckInstancePromise;
}
