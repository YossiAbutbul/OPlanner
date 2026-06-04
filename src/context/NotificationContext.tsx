import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { lsCache } from "../hooks/useLocalStorageCache";
import { isDesktopEnv, notificationsSupported } from "../utility/notifications";

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

  const value = useMemo<NotificationContextValue>(
    () => ({
      settings,
      setEnabled,
      setLeadMinutes,
      permission,
      requestPermission,
      supported,
      isDesktop,
    }),
    [settings, setEnabled, setLeadMinutes, permission, requestPermission, supported, isDesktop]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
};
