import { useCallback, useEffect, useState } from "react";

// Chrome's beforeinstallprompt isn't in lib.dom yet — define the minimum
// shape we use so we can keep the deferred prompt event around.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Detect a standalone-mode launch (PWA already installed and opened from
// the home screen / app launcher) so we don't offer install in-app.
const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari sets a non-standard navigator.standalone flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};

// Exposes install state for the in-app install button. canInstall is true
// only when the browser has fired beforeinstallprompt and the user hasn't
// already accepted/dismissed it this session. promptInstall() shows the
// native install dialog and resolves with the user's choice.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unsupported"> => {
    if (!deferredPrompt) return "unsupported";
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Per spec the deferred prompt can only be used once.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  return {
    canInstall: !installed && deferredPrompt !== null,
    installed,
    promptInstall,
  };
}
