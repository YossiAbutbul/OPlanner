import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "../context/ToastContext";

// Shows an in-app "New version available" toast when a fresh service
// worker is waiting. Clicking Reload activates it (skipWaiting +
// clientsClaim) and reloads the page so the user gets the new build.
// Registration lives here (injectRegister is null in vite.config) so the
// hook owns the SW lifecycle.
const PwaReloadPrompt: React.FC = () => {
  const toast = useToast();
  // Guard so we only raise one toast per waiting worker.
  const shownRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Poll for a new SW every hour so long-lived tabs still pick up
      // deploys without waiting for the browser's ~24h default check.
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!needRefresh || shownRef.current) return;
    shownRef.current = true;
    toast.info("New version available", {
      duration: Infinity,
      dismissible: true,
      closeOnAction: false,
      notesActions: [
        {
          label: "Reload",
          onClick: () => updateServiceWorker(true),
        },
      ],
    });
    // Reset the flag if the user dismisses (needRefresh flips back false
    // only on activation; dismiss just hides the toast).
    setNeedRefresh(false);
  }, [needRefresh, setNeedRefresh, toast, updateServiceWorker]);

  return null;
};

export default PwaReloadPrompt;
