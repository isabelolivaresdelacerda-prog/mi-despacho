// Mi Despacho: permite instalar la app en el ordenador o el móvil.
// Guarda la app para abrirla rápido; los datos siguen en el navegador de cada usuaria.
const CACHE = "mi-despacho-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Red primero; si no hay conexión, lo último guardado
  e.respondWith(
    fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match("/")))
  );
});
