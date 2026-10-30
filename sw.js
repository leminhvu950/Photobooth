const CACHE_NAME = "snapjoy-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./frame-slots.js",
  "./app.js",
  "./frames/ptb-page-2.png",
  "./frames/ptb-page-5.png",
  "./frames/ptb-page-13.png",
  "./icon.svg",
  "./manifest.webmanifest",
  "./admin/",
  "./admin/index.html",
  "./admin/admin.css",
  "./admin/admin.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))),
  );
});
