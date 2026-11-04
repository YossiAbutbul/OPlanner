import React, { useEffect, useState } from "react";
import { Toaster, type SileoPosition } from "sileo";
import ToastList from "./ToastList";
import { usePhoneToasts } from "../hooks/usePhoneToasts";
import { getThemePref, subscribeTheme, type ThemePref } from "../utility/theme";

// Two pseudo positions that sileo doesn't have: they are its bottom-center /
// bottom-right pinned to the content column rather than to the window, so a
// toast never lands on the course list or the assistant's composer.
export const CONTENT_CENTER = "bottom-center-content";
export const CONTENT_RIGHT = "bottom-right-content";
export type ToastPlacement = SileoPosition | typeof CONTENT_CENTER | typeof CONTENT_RIGHT;

// Where toasts appear by default: bottom-right of the content column.
export const DEFAULT_TOAST_POSITION: ToastPlacement = CONTENT_RIGHT;

// The dev toast lab (?toastlab=1) fires this to preview another position.
export const TOAST_POSITION_EVENT = "oplanner:toast-position";

const GAP = 16;
// A tighter gap at the bottom edge: it lines the collapsed pill up with the
// assistant's composer row instead of floating above it.
const BOTTOM_GAP = 8;

// The sidebars' own widths, zeroed under the breakpoint where they are hidden
// — sileo.css defines both. Keeping this in CSS means no measuring and no
// re-render when the window resizes.
const RIGHT_INSET = `calc(${GAP}px + var(--toast-right-inset, 0px))`;

// Sileo's viewport. Mounted once near the root; the toasts themselves are
// pushed through ToastContext (useToast). Its own light/dark palette follows
// the app's appearance choice rather than the system's.
//
// On a phone or in an installed PWA sileo stands down and the plain toast
// list takes over: there, the only toast that gets through is an actionable
// prompt (the update prompt), and it reads better as a plain bar than as a
// pill that expands over the content.
const AppToaster: React.FC = () => {
  const plain = usePhoneToasts();
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [placement, setPlacement] = useState<ToastPlacement>(DEFAULT_TOAST_POSITION);

  const position: SileoPosition =
    placement === CONTENT_CENTER
      ? "bottom-center"
      : placement === CONTENT_RIGHT
        ? "bottom-right"
        : placement;

  useEffect(() => subscribeTheme(() => setTheme(getThemePref())), []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onPosition = (e: Event) => {
      const next = (e as CustomEvent<ToastPlacement>).detail;
      if (next) setPlacement(next);
    };
    window.addEventListener(TOAST_POSITION_EVENT, onPosition);
    return () => window.removeEventListener(TOAST_POSITION_EVENT, onPosition);
  }, []);

  // Edge gaps per side. Top sits flush, Dynamic Island style; the others keep
  // a normal margin, and both vertical insets respect the phone's safe area.
  const offset = {
    top: "env(safe-area-inset-top, 0px)",
    bottom: `calc(${BOTTOM_GAP}px + env(safe-area-inset-bottom, 0px))`,
    left: position.endsWith("left") ? GAP : 0,
    right: placement === CONTENT_RIGHT ? RIGHT_INSET : position.endsWith("right") ? GAP : 0,
  };

  // Centring on the content column is a transform, so it goes through CSS.
  useEffect(() => {
    const root = document.documentElement;
    if (placement === CONTENT_CENTER) root.dataset.toastAlign = "content";
    else delete root.dataset.toastAlign;
  }, [placement]);

  if (plain) return <ToastList />;

  return <Toaster position={position} theme={theme} offset={offset} />;
};

export default AppToaster;
