const CACHE = "veter-static-v2";
const CORE = [
  "/assets/css/veter-ai.css",
  "/assets/js/veter-ai.js",
  "/manifest.webmanifest",
  "/assets/images/veter-ai-icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("veter-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept page navigations or HTML documents. This keeps games and
  // product pages on the normal browser network path instead of stale SW cache.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname.startsWith("/v1/") ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/"
  ) return;

  // Cache static assets only; a failed asset request should not break a page.
  if (!["style", "script", "image", "font"].includes(request.destination)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      return cached || new Response("", { status: 503, statusText: "Asset unavailable" });
    }
  })());
});
