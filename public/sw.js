// Mi Despacho: permite instalar la app. Red primero: siempre la última versión publicada.
const CACHE = "mi-despacho-v3";
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-store" }).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match("/")))
  );
});
