"use client";

import { useEffect } from "react";

export function MobileAppPwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    if (isLocalhost && process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, []);

  return null;
}
