const CACHE_NAME = "todo-tracker-shell-v1";
const APP_SHELL = [
  "/",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icons/todo-tracker-192.png",
  "/icons/todo-tracker-512.png",
  "/fonts/Geist-Variable.woff2",
  "/fonts/GeistMono-Variable.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Authentication and task data are private and must always go directly to the network.
  if (
    request.method !== "GET"
    || url.origin !== self.location.origin
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/.netlify/functions/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch((error) => {
          if (cached) return cached;
          throw error;
        });

      return cached ?? network;
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {
    title: "Todo Trackr",
    body: "Automation activity is ready to review.",
    url: "/",
    tag: "todo-trackr-automation",
  };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icons/todo-tracker-192.png",
    badge: "/icons/todo-tracker-192.png",
    tag: payload.tag,
    data: { url: payload.url ?? "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(destination);
        return;
      }
      await self.clients.openWindow(destination);
    }),
  );
});
