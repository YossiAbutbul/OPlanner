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
      // Poll for a new SW hourly so long-lived tabs pick up deploys
      // without waiting for the browser's ~24h default check.
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
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
