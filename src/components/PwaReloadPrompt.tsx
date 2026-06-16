import type { ReactElement } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import "../css/PwaReloadPrompt.css";

// Owns the service-worker lifecycle (injectRegister is null in vite.config).
// A new SW downloads in the background and waits; we surface a small banner so
// the user applies it on their terms (updateServiceWorker(true) skips waiting +
// reloads). Tap-to-update is the only path that reliably reaches an installed
// mobile PWA, where the app is suspended (not closed) so a waiting SW would
// otherwise never activate.
const PwaReloadPrompt = (): ReactElement | null => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      // Poll hourly so long-lived tabs still pick up deploys.
      setInterval(check, 60 * 60 * 1000);
      // Installed PWAs resume from memory without a navigation, and the OS
      // freezes timers in the background — so also check whenever the app
      // returns to the foreground. This is the main path by which a phone
      // discovers a new deploy.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update" role="status" aria-live="polite">
      <span className="pwa-update-text">A new version is available.</span>
      <button
        type="button"
        className="pwa-update-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </button>
    </div>
  );
};

export default PwaReloadPrompt;
