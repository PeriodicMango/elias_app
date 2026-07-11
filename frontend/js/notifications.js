// ---------------------------------------------------------------------------
// Elias — Push Notification Client
// Registers service worker, subscribes to push, sends subscription to server.
// ---------------------------------------------------------------------------

import { getToken } from "./api.js";

const SUBSCRIPTION_API = "/api/notifications/subscribe";
const VAPID_PUBLIC_KEY =
  window.__ELIAS_VAPID_KEY__ ||
  "PLACEHOLDER"; // Set in capacitor.config.ts or env

/**
 * Convert base64 to Uint8Array for applicationServerKey.
 */
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Request notification permission and subscribe to push.
 * @returns {Promise<PushSubscription | null>}
 */
export async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Notifications] Push API not available");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[Notifications] Permission denied");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Already subscribed — send to server again to ensure it's registered
      await sendToServer(subscription);
      return subscription;
    }

    // New subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        VAPID_PUBLIC_KEY !== "PLACEHOLDER"
          ? urlB64ToUint8Array(VAPID_PUBLIC_KEY)
          : undefined,
    });

    await sendToServer(subscription);
    console.log("[Notifications] Subscribed");
    return subscription;
  } catch (err) {
    console.error("[Notifications] Subscribe failed:", err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribe() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      const token = getToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${SUBSCRIPTION_API}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        credentials: "include",
      });
      console.log("[Notifications] Unsubscribed");
    }
  } catch (err) {
    console.error("[Notifications] Unsubscribe failed:", err);
  }
}

/**
 * Send subscription object to server.
 */
async function sendToServer(subscription) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  await fetch(SUBSCRIPTION_API, {
    method: "POST",
    headers,
    body: JSON.stringify(subscription.toJSON()),
    credentials: "include",
  });
}

/**
 * Register the service worker for push notifications.
 * Call on app startup.
 */
export async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[Notifications] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { scope: "/" }
    );
    console.log("[Notifications] SW registered");
    return registration;
  } catch (err) {
    console.error("[Notifications] SW registration failed:", err);
    return null;
  }
}

/**
 * Initialize: register SW + subscribe to push.
 * Call once on app startup.
 */
export async function initNotifications() {
  await registerSW();
  if (Notification.permission === "granted") {
    await subscribe();
  }
  // If not granted yet, user will be prompted on first proactive check
  // or via a settings toggle (future).
}
