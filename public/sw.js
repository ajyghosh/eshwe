const CACHE_NAME = "eshwe-app-v4";

const STATIC_ASSET_EXTENSIONS = new Set([
  "avif",
  "css",
  "gif",
  "ico",
  "jpg",
  "jpeg",
  "js",
  "json",
  "png",
  "svg",
  "webmanifest",
  "webp",
  "woff",
  "woff2"
]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("eshwe-app-"))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    request.mode === "navigate" ||
    requestUrl.pathname.startsWith("/api/") ||
    isNextFlightRequest(request, requestUrl) ||
    !isCacheableStaticAsset(requestUrl)
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!isCacheableResponse(networkResponse)) {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();

        void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));

        return networkResponse;
      });
    })
  );
});

function isNextFlightRequest(request, requestUrl) {
  return (
    requestUrl.searchParams.has("_rsc") ||
    requestUrl.pathname.endsWith(".txt") ||
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    request.headers.has("Next-Url")
  );
}

function isCacheableStaticAsset(requestUrl) {
  const extension = requestUrl.pathname.split(".").pop()?.toLowerCase();

  return Boolean(extension && STATIC_ASSET_EXTENSIONS.has(extension));
}

function isCacheableResponse(response) {
  return Boolean(response && response.status === 200 && response.type === "basic" && !isFlightResponse(response));
}

function isFlightResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  return contentType.includes("text/x-component") || contentType.includes("text/plain");
}
