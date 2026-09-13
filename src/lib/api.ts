import { buildProtectedJsonHeadersForPath } from "@/lib/protected-request";

const functionNames: Record<string, string> = {
  "/api/razorpay/create-order": "createRazorpayOrder",
  "/api/razorpay/verify-payment": "verifyRazorpayPayment",
  "/api/checkout/status": "checkoutStatus",
  "/api/owner/product": "ownerProductAction",
  "/api/owner/order": "ownerOrderAction"
};

export function apiUrl(path: string) {
  const emulator = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_URL;
  return emulator && functionNames[path] ? `${emulator}/${functionNames[path]}` : path;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public internalOrderId?: string) { super(message); }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = apiUrl(path);
  const response = await fetch(url, { method: "POST", headers: await buildProtectedJsonHeadersForPath(url), body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.error || "The request could not be completed. Please try again.", response.status, result.internalOrderId);
  return result as T;
}
