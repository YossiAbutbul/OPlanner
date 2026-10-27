// Appearance preference: Light or Dark, chosen in Settings.
// Applied as <html data-theme="light|dark">, which index.css keys its dark
// token block on. Stored in localStorage so the choice survives reloads, and
// applied at import time from main.tsx so the first paint already has the
// right colors. Until someone picks, the app is Light (not the system's).

export type ThemePref = "light" | "dark";

const KEY = "oplanner:theme";
const EVENT = "oplanner:theme-change";

function storedPref(): ThemePref | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Storage blocked (private mode): fall back to the default (Light).
  }
  return null;
}

/** The appearance in effect: the saved choice, else Light. */
export function getThemePref(): ThemePref {
  return storedPref() ?? "light";
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
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener(EVENT, cb);
  };
}

// Always set data-theme, so a dark system setting can't switch the app to
// dark (index.css's system-dark block only applies without data-theme="light").
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = getThemePref();
}
