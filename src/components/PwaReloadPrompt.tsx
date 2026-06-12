import { useRegisterSW } from "virtual:pwa-register/react";

// Owns the service-worker lifecycle (injectRegister is null in vite.config).
// Update strategy is "apply on next launch": we only *check* for a new SW
// here so it downloads in the background and sits waiting; it activates on
// the next app start, so the running session is never reloaded and no
// prompt is shown.
const PwaReloadPrompt = (): null => {
  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      // Poll hourly so long-lived tabs still pick up deploys.
      setInterval(check, 60 * 60 * 1000);
      // Installed PWAs resume from memory without a navigation, and the
      // OS freezes timers in the background — so also check whenever the
      // app returns to the foreground. This is the main path by which a
      // phone discovers a new deploy (downloaded now, applied next open).
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  return null;
};

export default PwaReloadPrompt;
