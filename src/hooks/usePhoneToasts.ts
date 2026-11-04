import { useEffect, useState } from "react";

// True on a phone-sized viewport or in an installed PWA on any screen.
//
// Both drop transient toasts entirely — on a small screen they cover the
// thing the user just acted on, and the action already shows its own result
// — and render the few actionable prompts that remain (the update prompt)
// with the plain toast list instead of sileo's pill.
//
// 480px is the breakpoint Toast.css has always used for the phone layout.
const PHONE_MQ = "(max-width: 480px)";
const STANDALONE_MQ = "(display-mode: standalone)";

export const checkPhoneToasts = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const standalone =
    window.matchMedia(STANDALONE_MQ).matches ||
    // iOS Safari's non-standard flag, the only signal there.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia(PHONE_MQ).matches;
};

export function usePhoneToasts(): boolean {
  const [value, setValue] = useState<boolean>(checkPhoneToasts);

  useEffect(() => {
    if (!window.matchMedia) return;
    // display-mode flips when the app is installed or opened in a tab; the
    // width query fires on rotation and on a resized desktop window.
    const queries = [window.matchMedia(STANDALONE_MQ), window.matchMedia(PHONE_MQ)];
    const update = () => setValue(checkPhoneToasts());
    for (const q of queries) q.addEventListener("change", update);
    return () => {
      for (const q of queries) q.removeEventListener("change", update);
    };
  }, []);

  return value;
}
