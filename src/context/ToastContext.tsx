import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
  // Sugar for the common cases.
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_TTL_MS = 4500;

// Counter is sufficient — single-tab, no SSR. Avoids Date.now() / Math.random()
// which would defeat React strict-mode double-invocation determinism.
let counter = 0;
const nextId = () => `toast-${++counter}`;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, kind, message }]);
      // Auto-dismiss after TTL. Errors stay slightly longer so the user
      // can actually read them before they fade.
      const ttl = kind === "error" ? TOAST_TTL_MS + 1500 : TOAST_TTL_MS;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
    }),
    [toasts, push, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
