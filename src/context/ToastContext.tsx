import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  // Sticky toasts never auto-dismiss — used for actionable prompts like
  // "New version available". The user must click the action or close it.
  sticky?: boolean;
  action?: ToastAction;
}

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  sticky?: boolean;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, opts?: ToastOptions) => void;
  dismiss: (id: string) => void;
  // Sugar for the common cases.
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_TTL_MS = 4500;
// Cap the visible stack so spamming an action can't bury the screen.
const MAX_TOASTS = 3;

// Counter is sufficient — single-tab, no SSR. Avoids Date.now() / Math.random()
// which would defeat React strict-mode double-invocation determinism.
let counter = 0;
const nextId = () => `toast-${++counter}`;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track auto-dismiss timers by id so coalescing/dismiss can cancel a stale
  // one instead of letting it fire against a recycled toast.
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, opts?: ToastOptions) => {
      const sticky = opts?.sticky;
      const id = nextId();
      setToasts((prev) => {
        // Coalesce: if an identical non-sticky toast is already showing, drop it
        // so a spammed action just refreshes one toast instead of stacking.
        let next = prev.filter((t) => {
          const dup = !t.sticky && !sticky && t.kind === kind && t.message === message;
          if (dup) {
            const h = timers.current.get(t.id);
            if (h !== undefined) { window.clearTimeout(h); timers.current.delete(t.id); }
          }
          return !dup;
        });
        next = [...next, { id, kind, message, sticky, action: opts?.action }];
        // Cap the stack — evict oldest non-sticky toasts past the limit.
        while (next.length > MAX_TOASTS) {
          const victim = next.find((t) => !t.sticky);
          if (!victim) break;
          const h = timers.current.get(victim.id);
          if (h !== undefined) { window.clearTimeout(h); timers.current.delete(victim.id); }
          next = next.filter((t) => t.id !== victim.id);
        }
        return next;
      });
      // Auto-dismiss after TTL unless sticky. Errors stay slightly longer
      // so the user can actually read them before they fade.
      if (!sticky) {
        const ttl = kind === "error" ? TOAST_TTL_MS + 1500 : TOAST_TTL_MS;
        timers.current.set(id, window.setTimeout(() => dismiss(id), ttl));
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (m: string, o?: ToastOptions) => push("success", m, o),
      error: (m: string, o?: ToastOptions) => push("error", m, o),
      info: (m: string, o?: ToastOptions) => push("info", m, o),
    }),
    [toasts, push, dismiss]
  );

  // Dev-only debug hook: expose toast API on window so `__toast.error("x")`
  // works from the browser console. Effect-bound so the assignment doesn't
  // mutate window during render. No effect in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as unknown as { __toast?: ToastContextValue }).__toast = value;
  }, [value]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
