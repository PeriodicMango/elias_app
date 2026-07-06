// ---------------------------------------------------------------------------
// Elias — Push Notification Service Worker
// Handles incoming push events and notification clicks.
// Does NOT cache anything (no PWA caching).
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const { title, body, icon, data } = event.data.json();

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || "/icon.svg",
        badge: "/icon.svg",
        data: data || {},
        vibrate: [200, 100, 200],
        requireInteraction: false,
        tag: "elias-proactive",
      })
    );
  } catch {
    // Fallback: plain text notification
    event.waitUntil(
      self.registration.showNotification("Elias", {
        body: event.data.text(),
        icon: "/icon.svg",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Focus existing window or open new one
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients[0];
        if (existing) {
          existing.focus();
        } else {
          self.clients.openWindow("/");
        }
      })
  );
});
