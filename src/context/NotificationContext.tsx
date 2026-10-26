import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { lsCache } from "../hooks/useLocalStorageCache";
import { useAuth } from "./AuthContext";
import { isDesktopEnv, notificationsSupported } from "../utility/notifications";
import {
  disablePush,
  enablePush,
  getPushSubscription,
  isInstalledPwa,
  pushSupported,
} from "../utility/push";

export interface NotifSettings {
  enabled: boolean;
  leadMinutes: number; // lead time for the "starts in N min" task reminder
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = { enabled: true, leadMinutes: 15 };

const SETTINGS_KEY = "oplanner.notif.settings";

// "unsupported" collapses the (no Notification API) case so callers don't have
// to special-case it everywhere.
export type PermissionState = NotificationPermission | "unsupported";

interface NotificationContextValue {
  settings: NotifSettings;
  setEnabled: (enabled: boolean) => void;
  setLeadMinutes: (minutes: number) => void;
  permission: PermissionState;
  requestPermission: () => Promise<PermissionState>;
  supported: boolean;
  isDesktop: boolean;
  // Installed PWA that can receive Web Push: reminders come from the server
  // and the in-app scan stays off.
  pushAvailable: boolean;
  installed: boolean;
  // This device holds a push subscription (also true in a browser tab of a
  // site whose installed app subscribed: same service worker).
  pushSubscribed: boolean;
  pushError: boolean;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const loadSettings = (): NotifSettings => {
  const raw = lsCache.read<Partial<NotifSettings>>(SETTINGS_KEY);
  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULT_NOTIF_SETTINGS.enabled,
    leadMinutes:
      typeof raw?.leadMinutes === "number" && raw.leadMinutes >= 0
        ? raw.leadMinutes
        : DEFAULT_NOTIF_SETTINGS.leadMinutes,
  };
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supported = notificationsSupported();
  const isDesktop = isDesktopEnv();
  const installed = isInstalledPwa();
  const pushAvailable = installed && supported && pushSupported();
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;

  const [settings, setSettings] = useState<NotifSettings>(loadSettings);
  const [permission, setPermission] = useState<PermissionState>(
    supported ? Notification.permission : "unsupported"
  );

  const persist = useCallback((next: NotifSettings) => {
    setSettings(next);
    lsCache.write(SETTINGS_KEY, next);
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...loadSettings(), enabled }),
    [persist]
  );

  const setLeadMinutes = useCallback(
    (minutes: number) =>
      persist({ ...loadSettings(), leadMinutes: Math.max(0, Math.round(minutes)) }),
    [persist]
  );

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!supported) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return Notification.permission;
    }
  }, [supported]);

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushError, setPushError] = useState(false);

  useEffect(() => {
    getPushSubscription()
      .then((s) => setPushSubscribed(!!s))
      .catch(() => {});
  }, []);

  // Keep this device's push subscription in step with the settings: subscribe
  // (and refresh tz / lead time) when on and allowed, remove when off.
  useEffect(() => {
    if (!pushAvailable || !uid) return;
    let cancelled = false;
    const run = async () => {
      try {
        if (settings.enabled && permission === "granted") {
          await enablePush(uid, settings.leadMinutes);
          if (!cancelled) setPushSubscribed(true);
        } else if (!settings.enabled) {
          await disablePush(uid);
          if (!cancelled) setPushSubscribed(false);
        }
        if (!cancelled) setPushError(false);
      } catch {
        if (!cancelled) setPushError(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pushAvailable, uid, settings.enabled, settings.leadMinutes, permission]);

  // Signed out: drop the browser subscription so the previous account's
  // reminders stop reaching this device. Its doc can't be deleted without
  // auth; the server removes it on the next send (410 Gone).
  useEffect(() => {
    if (loading || uid) return;
    getPushSubscription()
      .then((s) => s?.unsubscribe())
      .then(() => setPushSubscribed(false))
      .catch(() => {});
  }, [loading, uid]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      settings,
      setEnabled,
      setLeadMinutes,
      permission,
      requestPermission,
      supported,
      isDesktop,
      pushAvailable,
      installed,
      pushSubscribed,
      pushError,
    }),
    [
      settings,
      setEnabled,
      setLeadMinutes,
      permission,
      requestPermission,
      supported,
      isDesktop,
      pushAvailable,
      installed,
      pushSubscribed,
      pushError,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
};
