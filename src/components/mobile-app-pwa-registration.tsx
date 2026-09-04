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

    if (isLocalhost) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        void Promise.all(registrations.map((registration) => registration.unregister()));
      });

      if ("caches" in window) {
        void caches.keys().then((keys) => {
          void Promise.all(
            keys
              .filter((key) => key.startsWith("eshwe-app-"))
              .map((key) => caches.delete(key))
          );
        });
      }

      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, []);

  return null;
}
