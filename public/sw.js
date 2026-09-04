const CACHE_NAME = "eshwe-app-v2";
const APP_SHELL_PATHS = [
  "/app/",
  "/app/search/",
  "/app/favorites/",
  "/app/orders/",
  "/app/account/",
  "/favicon/web-app-manifest-192x192.png",
  "/favicon/web-app-manifest-512x512.png",
  "/eshwelogo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_PATHS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

          return Promise.resolve(false);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();

          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));

          return networkResponse;
        })
        .catch(() => caches.match(request).then((cachedResponse) => cachedResponse ?? caches.match("/app/")))
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();

          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));

          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/app/");
          }

          return Response.error();
        });
    })
  );
});
