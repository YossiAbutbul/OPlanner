import { useEffect, useState } from "react";

// True on a phone, in a browser tab or an installed PWA alike.
//
// A phone drops transient toasts entirely — on a screen that small they cover
// the thing just acted on, and the result of an action is already visible in
// the UI — and renders the prompts that remain (the update prompt) with the
// plain toast list instead of sileo's pill. Everything else, a tablet and an
// installed desktop PWA included, keeps sileo.
//
// Measured as the shorter side of the device's screen, so rotating a phone
// doesn't change the answer: a 390x844 phone is 390 either way up, while the
// viewport alone would read 844 in landscape and turn the toasts back on
// mid-session. The screen is also independent of how large the window is, so
// a small desktop window stays a desktop.
//
// 480px is the breakpoint Toast.css has always used for the phone layout.
const PHONE_MAX_PX = 480;

const shorterSide = (): number => {
  const screen = window.screen as Screen | undefined;
  const width = screen?.width || window.innerWidth;
  const height = screen?.height || window.innerHeight;
  // A zero or missing dimension must not read as "tiny, so a phone".
  return Math.min(width || Infinity, height || Infinity);
};

export const checkPhoneToasts = (): boolean => {
  if (typeof window === "undefined") return false;
  return shorterSide() <= PHONE_MAX_PX;
};

export function usePhoneToasts(): boolean {
  const [value, setValue] = useState<boolean>(checkPhoneToasts);

  useEffect(() => {
    // The screen's own size doesn't change, but page zoom reports it in CSS
    // pixels, so a zoom change can move the answer. Both events cover that.
    const update = () => setValue(checkPhoneToasts());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return value;
}
