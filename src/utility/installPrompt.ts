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

// Persisted across tabs/sessions so the install option stays hidden after
// install even in a plain browser tab (where display-mode isn't standalone).
const INSTALLED_KEY = "oplanner.pwa.installed";
const readFlag = () => {
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
};
const writeFlag = (v: boolean) => {
  try {
    if (v) localStorage.setItem(INSTALLED_KEY, "1");
    else localStorage.removeItem(INSTALLED_KEY);
  } catch { /* ignore */ }
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome's mini-infobar; we surface our own install affordance.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    // The event only fires when the app is installable and NOT installed — so
    // if a stale "installed" flag is set (user uninstalled), clear it now so
    // the option reappears for re-testing.
    writeFlag(false);
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    writeFlag(true);
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

/** True when installed — either running standalone, or the persisted flag is
 *  set (covers a normal browser tab after install). Cleared automatically when
 *  the app becomes installable again (uninstall), so re-testing just works. */
export const isInstalled = (): boolean => isStandalone() || readFlag();
