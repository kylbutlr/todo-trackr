import { api } from "./api.js";

export type WebPushState = "unsupported" | "unconfigured" | "blocked" | "disabled" | "enabled";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function webPushState(): Promise<WebPushState> {
  if (!supported()) return "unsupported";
  const configuration = await api.pushConfiguration();
  if (!configuration.configured) return "unconfigured";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.getSubscription() ? "enabled" : "disabled";
}

export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return "unsupported";
  const configuration = await api.pushConfiguration();
  if (!configuration.configured || !configuration.publicKey) return "unconfigured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "disabled";

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(configuration.publicKey),
  });
  await api.savePushSubscription(subscription.toJSON());
  return "enabled";
}

export async function disableWebPush(): Promise<WebPushState> {
  if (!supported()) return "unsupported";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api.removePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  return "disabled";
}
