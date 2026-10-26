// Web Push subscription for the installed PWA. The browser hands us a push
// endpoint; we store it under users/{uid}/pushSubs/{id} with the device's
// time zone and lead time, and api/send-reminders.ts (run by a cron) sends
// reminders to it — so they arrive while OPlanner is closed.
//
// Installed-PWA only: in a regular browser tab the in-app reminder scan in
// useReminders covers desktop while the tab is open.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// True when running as an installed app (standalone window / iOS home screen).
export const isInstalledPwa = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const pushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  !!VAPID_PUBLIC_KEY;

// VAPID keys are base64url; PushManager wants the raw bytes.
const base64UrlToBytes = (b64url: string): Uint8Array<ArrayBuffer> => {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

// Stable doc id per endpoint, so re-subscribing the same device overwrites
// its doc instead of piling up duplicates.
const subId = async (endpoint: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
};

const subDoc = (uid: string, id: string) => doc(db, "users", uid, "pushSubs", id);

const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

// The registration's current push subscription, if any. Never prompts.
export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
};

// Subscribe this device (or reuse its subscription) and upsert its doc.
// Requires notification permission already granted.
export const enablePush = async (uid: string, leadMinutes: number): Promise<void> => {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) throw new Error("Push not supported");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Incomplete push subscription");
  }
  await setDoc(subDoc(uid, await subId(json.endpoint)), {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    tz: deviceTimeZone(),
    leadMinutes,
    updatedAt: serverTimestamp(),
  });
};

// Unsubscribe this device and remove its doc. Safe to call when not subscribed.
export const disablePush = async (uid: string): Promise<void> => {
  const sub = await getPushSubscription();
  if (!sub) return;
  await deleteDoc(subDoc(uid, await subId(sub.endpoint))).catch(() => {});
  await sub.unsubscribe().catch(() => false);
};
