"use client";

import { signInWithCustomToken, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { buildProtectedJsonHeadersForPath } from "@/lib/protected-request";

const CUSTOMER_AUTH_FUNCTIONS_ORIGIN = "https://asia-south1-eshwesareestudio.cloudfunctions.net";
const CUSTOMER_AUTH_API_BASE_PATH = "/api/customer-auth";

type VerifyCustomerOtpResponse = {
  customToken: string;
  success: true;
};

export async function sendCustomerOtp(phone: string) {
  const requestUrl = getCustomerAuthApiUrl("send-otp");
  const headers = await buildProtectedJsonHeadersForPath(requestUrl);
  const response = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone })
  });
  const payload = await parseCustomerAuthResponse(response, "Verification SMS could not be sent.");

  return payload as { cooldownSeconds?: number; success: true };
}

export async function verifyCustomerOtp(phone: string, otp: string): Promise<User> {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured. Add NEXT_PUBLIC_FIREBASE_* variables.");
  }

  const requestUrl = getCustomerAuthApiUrl("verify-otp");
  const headers = await buildProtectedJsonHeadersForPath(requestUrl);
  const response = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ otp, phone })
  });
  const payload = (await parseCustomerAuthResponse(
    response,
    "Code verification failed."
  )) as VerifyCustomerOtpResponse;
  const credential = await signInWithCustomToken(auth, payload.customToken);

  return credential.user;
}

export function getCustomerAuthApiUrl(path: "send-otp" | "verify-otp") {
  const endpointPath = path === "send-otp" ? "send-otp" : "verify-otp";

  if (typeof window !== "undefined" && !isLocalDevelopmentHostname(window.location.hostname)) {
    return `${CUSTOMER_AUTH_API_BASE_PATH}/${endpointPath}`;
  }

  if (path === "send-otp") {
    return `${CUSTOMER_AUTH_FUNCTIONS_ORIGIN}/sendCustomerOtp`;
  }

  return `${CUSTOMER_AUTH_FUNCTIONS_ORIGIN}/verifyCustomerOtp`;
}

function isLocalDevelopmentHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

async function parseCustomerAuthResponse(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (response.ok) {
    return payload ?? {};
  }

  throw new Error(readCustomerAuthError(payload, fallbackMessage));
}

function readCustomerAuthError(payload: Record<string, unknown> | null, fallbackMessage: string) {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallbackMessage;
}
