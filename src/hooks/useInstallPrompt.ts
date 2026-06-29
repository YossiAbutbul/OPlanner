import { useCallback, useEffect, useState } from "react";
import {
  clearDeferredPrompt,
  getDeferredPrompt,
  isStandalone,
  subscribeInstall,
} from "../utility/installPrompt";

// Exposes install state for the in-app install button. The deferred prompt is
// captured at module load (see ../utility/installPrompt) so it's available even
// if Chrome fired beforeinstallprompt before React mounted. canInstall is true
// once that event exists and the app isn't already installed; promptInstall()
// shows the native dialog and resolves with the user's choice.
export function useInstallPrompt() {
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  // Bump to re-read getDeferredPrompt() when availability changes.
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = subscribeInstall(() => {
      if (isStandalone()) setInstalled(true);
      force((n) => n + 1);
    });
    return unsub;
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unsupported"> => {
    const dp = getDeferredPrompt();
    if (!dp) return "unsupported";
    await dp.prompt();
    const { outcome } = await dp.userChoice;
    clearDeferredPrompt();
    force((n) => n + 1);
    return outcome;
  }, []);

  return {
    canInstall: !installed && getDeferredPrompt() !== null,
    installed,
    promptInstall,
  };
}
