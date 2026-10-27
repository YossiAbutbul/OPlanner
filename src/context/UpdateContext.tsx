import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Owns the service-worker lifecycle (injectRegister is null in vite.config).
// A new build downloads in the background and waits; the app applies it on
// the user's terms (PwaReloadPrompt, or Check for updates in settings).

export type CheckResult = "available" | "current" | "offline";

interface UpdateContextValue {
  // The running build, from package.json.
  version: string;
  // A newer build is downloaded and waiting.
  needRefresh: boolean;
  // Its version, once read from version.json; null until then.
  nextVersion: string | null;
  applyUpdate: () => void;
  checkForUpdates: () => Promise<CheckResult>;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

// version.json sits next to index.html in every build and is never cached,
// so it always names the newest deploy.
const fetchLatestVersion = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
};

// Resolves once a worker that started installing is installed (or gone).
const settled = (worker: ServiceWorker): Promise<boolean> =>
  new Promise((resolve) => {
    const done = () => {
      if (worker.state === "installed" || worker.state === "activated") resolve(true);
      else if (worker.state === "redundant") resolve(false);
    };
    worker.addEventListener("statechange", done);
    done();
  });

export const UpdateProvider = ({ children }: { children: ReactNode }) => {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      const check = () => registration.update().catch(() => {});
      // Poll hourly so long-lived tabs still pick up deploys.
      setInterval(check, 60 * 60 * 1000);
      // Installed PWAs resume from memory without a navigation, and the OS
      // freezes timers in the background, so also check whenever the app
      // returns to the foreground. This is the main path by which a phone
      // discovers a new deploy.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  const [nextVersion, setNextVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!needRefresh) return;
    let cancelled = false;
    void fetchLatestVersion().then((v) => {
      if (!cancelled && v && v !== __APP_VERSION__) setNextVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, [needRefresh]);

  const applyUpdate = useCallback(() => {
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  const checkForUpdates = useCallback(async (): Promise<CheckResult> => {
    if (!navigator.onLine) return "offline";
    const reg = registrationRef.current;
    // The dev server has neither a service worker nor version.json.
    if (import.meta.env.DEV) return "current";
    if (!reg) {
      // No service worker (a browser without one): compare
      // against the deployed version.json instead.
      const latest = await fetchLatestVersion();
      if (latest === null) return "offline";
      return latest !== __APP_VERSION__ ? "available" : "current";
    }
    try {
      await reg.update();
    } catch {
      return "offline";
    }
    if (reg.waiting) return "available";
    if (reg.installing) return (await settled(reg.installing)) ? "available" : "current";
    return "current";
  }, []);

  const value = useMemo(
    () => ({ version: __APP_VERSION__, needRefresh, nextVersion, applyUpdate, checkForUpdates }),
    [needRefresh, nextVersion, applyUpdate, checkForUpdates]
  );
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
};

export const useUpdate = (): UpdateContextValue => {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error("useUpdate must be used inside UpdateProvider");
  return ctx;
};
