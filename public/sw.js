const CACHE_NAME = "eshwe-app-v6";
const OFFLINE_URL = "/offline.html";
const STATIC_EXTENSIONS = /\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webmanifest|webp|woff2?)$/i;
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("eshwe-app-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    // Never store authenticated pages or receipts; only the generic fallback.
    // Bypass the browser HTTP cache too: a cached app shell can hang waiting for
    // live data offline instead of reaching the reconnect document.
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("You are offline. Reconnect and reload to check your order.", { status: 503, headers: { "Content-Type": "text/plain" } })));
    return;
  }
  if (url.searchParams.has("_rsc") || url.pathname.endsWith(".txt") || request.headers.get("RSC") === "1" || request.headers.has("Next-Router-State-Tree") || !STATIC_EXTENSIONS.test(url.pathname)) return;
  const network = async () => {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.headers.get("content-type")?.includes("text/x-component")) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request,copy)));
    }
    return response;
  };
  // Only content-hashed build assets are immutable. Logos/icons revalidate.
  const immutable = url.pathname.startsWith("/_next/static/");
  event.respondWith(immutable ? caches.match(request).then(cached => cached || network()) : network().catch(async () => (await caches.match(request)) || Response.error()));
});
