/// <reference lib="webworker" />
// Custom service worker (vite-plugin-pwa injectManifest). Reproduces what the
// generated SW did (precache + SPA navigation fallback + prompt-style update)
// and adds Web Push: api/send-reminders.ts sends reminders here, so they
// arrive while OPlanner is closed.
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

precacheAndRoute(self.__WB_MANIFEST);
// Drop caches from superseded SW versions so an old shell can't linger and
// reference evicted/renamed chunks.
cleanupOutdatedCaches();

// Firestore + Auth must hit the network, never the cached shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/__\/auth\//, /firestore\.googleapis\.com/],
  })
);

// updateServiceWorker(true) in PwaReloadPrompt posts this to apply a waiting
// SW. Never skip waiting on our own: the running session stays on its build.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

interface PushPayload {
  title: string;
  body: string;
  tag: string;
}

const iconUrl = new URL("pwa-icon.svg", self.registration.scope).href;

self.addEventListener("push", (event) => {
  let data: PushPayload;
  try {
    data = event.data?.json() as PushPayload;
  } catch {
    return;
  }
  if (!data?.title) return;
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body,
    tag: data.tag,
    icon: iconUrl,
    badge: iconUrl,
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Focus an open OPlanner window if there is one, otherwise open the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(self.registration.scope);
    })()
  );
});
