import { useEffect, useState } from "react";

// True when the app is running as an installed PWA (display-mode: standalone
// or iOS Safari's non-standard navigator.standalone) AND the viewport is in
// the mobile size range. Used to gate touch gestures (edge swipes etc.) so
// they don't conflict with browser back-gestures in a regular tab or fire
// on desktop where there's no obvious "edge" the user can drag from.
export function usePwaMobile(): boolean {
  const [value, setValue] = useState<boolean>(() => check());

  useEffect(() => {
    // Both signals can change at runtime — display-mode flips if the user
    // installs/uninstalls while the tab is open; the size query fires on
    // rotation. Track both via matchMedia listeners.
    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    const mobileMq = window.matchMedia("(max-width: 1024px)");
    const update = () => setValue(check());
    standaloneMq.addEventListener("change", update);
    mobileMq.addEventListener("change", update);
    return () => {
      standaloneMq.removeEventListener("change", update);
      mobileMq.removeEventListener("change", update);
    };
  }, []);

  return value;
}

const check = (): boolean => {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mobile = window.matchMedia("(max-width: 1024px)").matches;
  return standalone && mobile;
};
