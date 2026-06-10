import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "../context/ToastContext";

// Shows an in-app "New version available" toast when a fresh service
// worker is waiting. Clicking Reload activates it (skipWaiting) and
// reloads the page so the user gets the new build. Registration lives
// here (injectRegister is null in vite.config) so the hook owns the SW
// lifecycle — must be mounted inside ToastProvider.
const PwaReloadPrompt = (): null => {
  const toast = useToast();
  // Guard so we raise the toast only once per waiting worker.
  const shownRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      // Poll for a new SW hourly so long-lived tabs pick up deploys
      // without waiting for the browser's ~24h default check.
      setInterval(check, 60 * 60 * 1000);
      // Installed PWAs resume from memory without a navigation, and the
      // OS freezes timers in the background — so also check whenever the
      // app returns to the foreground. This is the main path by which a
      // phone actually discovers a new deploy.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh || shownRef.current) return;
    shownRef.current = true;
    toast.info("New version available", {
      sticky: true,
      action: {
        label: "Reload",
        // true => skipWaiting + auto window.location.reload() after the
        // new SW takes control.
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
};

export default PwaReloadPrompt;
