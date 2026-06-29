// Captures the browser's `beforeinstallprompt` event at module-load time —
// far earlier than a React effect — so the in-app "Install" button can fire
// the real native prompt. Chrome fires this event once, early; if we only
// listened from a mounted component we'd miss it and fall back to the manual
// help modal. Import this module first in main.tsx so the listener is live ASAP.

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome's mini-infobar; we surface our own install affordance.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** The stashed install event, or null when install isn't currently available. */
export const getDeferredPrompt = () => deferred;

/** Per spec the prompt can only be used once — clear it after firing. */
export const clearDeferredPrompt = () => {
  deferred = null;
};

/** Subscribe to availability changes (prompt captured / app installed). */
export const subscribeInstall = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** True when launched as an installed PWA (home-screen / app window). */
export const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};
