declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayEventResponse = {
  error?: {
    code?: string;
    description?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
    reason?: string;
    source?: string;
    step?: string;
  };
};

type RazorpayCheckoutOptions = {
  amount: number;
  currency: string;
  description?: string;
  handler: (response: RazorpayHandlerResponse) => void | Promise<void>;
  image?: string;
  key: string;
  modal?: {
    ondismiss?: () => void;
  };
  name?: string;
  notes?: Record<string, string>;
  order_id: string;
  prefill?: {
    contact?: string;
    email?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayInstance = {
  on: (eventName: "payment.failed", handler: (response: RazorpayEventResponse) => void) => void;
  open: () => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_FUNCTIONS_ORIGIN = "https://asia-south1-eshwesareestudio.cloudfunctions.net";
const RAZORPAY_API_BASE_PATH = "/api/razorpay";

export type { RazorpayCheckoutOptions, RazorpayEventResponse, RazorpayHandlerResponse, RazorpayInstance };
export { getRazorpayApiUrl };

export async function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    throw new Error("Razorpay checkout can only load in the browser.");
  }

  if (window.Razorpay) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);

  if (existingScript) {
    await waitForRazorpay();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.head.appendChild(script);
  });

  await waitForRazorpay();
}

async function waitForRazorpay() {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (window.Razorpay) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("Razorpay checkout did not become available.");
}

function getRazorpayApiUrl(path: "create-order" | "verify-payment" | "webhook") {
  const endpointPath =
    path === "create-order"
      ? "create-order"
      : path === "verify-payment"
        ? "verify-payment"
        : "webhook";

  if (typeof window !== "undefined" && !isLocalDevelopmentHostname(window.location.hostname)) {
    return `${RAZORPAY_API_BASE_PATH}/${endpointPath}`;
  }

  if (path === "create-order") {
    return `${RAZORPAY_FUNCTIONS_ORIGIN}/createRazorpayOrder`;
  }

  if (path === "verify-payment") {
    return `${RAZORPAY_FUNCTIONS_ORIGIN}/verifyRazorpayPayment`;
  }

  return `${RAZORPAY_FUNCTIONS_ORIGIN}/razorpayWebhook`;
}

function isLocalDevelopmentHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
