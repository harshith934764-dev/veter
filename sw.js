const CACHE = "veter-ai-shell-v1";
const CORE = ["/veter-ai.html","/assets/css/veter-ai.css","/assets/js/veter-ai.js","/manifest.webmanifest","/assets/images/veter-ai-icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/v1/")) return;
  e.respondWith(fetch(e.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return response;
  }).catch(() => caches.match(e.request).then(cached => cached || Response.error())));
});
