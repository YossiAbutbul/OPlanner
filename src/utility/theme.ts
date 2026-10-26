// Appearance preference: Light or Dark, chosen in Settings.
// Applied as <html data-theme="light|dark">, which index.css keys its dark
// token block on. Stored in localStorage so the choice survives reloads, and
// applied at import time from main.tsx so the first paint already has the
// right colors. Until someone picks, the system appearance decides.

export type ThemePref = "light" | "dark";

const KEY = "oplanner:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const EVENT = "oplanner:theme-change";

function storedPref(): ThemePref | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Storage blocked (private mode): fall back to the system appearance.
  }
  return null;
}

/** The appearance in effect: the saved choice, else the system's. */
export function getThemePref(): ThemePref {
  return storedPref() ?? (window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light");
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Not persisted, but still applied for this session.
  }
  const apply = () => {
    document.documentElement.dataset.theme = pref;
  };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  // Ease the brightness change with a cross-fade instead of a hard cut.
  if (doc.startViewTransition && !reduce) doc.startViewTransition(apply);
  else apply();
  window.dispatchEvent(new Event(EVENT));
}

/** Whether dark colors are in effect right now. */
export function isDarkActive(): boolean {
  return getThemePref() === "dark";
}

/** Subscribe to anything that can change the effective appearance. */
export function subscribeTheme(cb: () => void): () => void {
  const mq = window.matchMedia?.(DARK_QUERY);
  mq?.addEventListener("change", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    mq?.removeEventListener("change", cb);
    window.removeEventListener(EVENT, cb);
  };
}

if (typeof document !== "undefined") {
  const saved = storedPref();
  if (saved) document.documentElement.dataset.theme = saved;
}
