import { useSyncExternalStore } from "react";
import { getThemePref, isDarkActive, setThemePref, subscribeTheme, type ThemePref } from "../utility/theme";

// React-bound view of the appearance preference (Light / Dark).
export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribeTheme, getThemePref, () => "light" as const);
  return [pref, setThemePref];
}

/** True while dark colors are in effect, for canvas code that can't read CSS. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeTheme, isDarkActive, () => false);
}
