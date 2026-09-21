const CACHE_NAME = "aris-vault-pwa-v1";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/app-icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/offline.html",
];

const NEVER_CACHE_PREFIXES = [
  "/api/",
  "/cards/",
  "/metals/",
  "/auth/",
  "/go/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  return NEVER_CACHE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix));
}

function isStaticAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/offline.html" ||
    url.pathname.startsWith("/app-icon") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/tesseract/")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || new Response("You are offline.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }),
    );
    return;
  }

  if (!isStaticAsset(url)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
