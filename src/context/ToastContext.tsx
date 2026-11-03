import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { sileo } from "sileo";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  // A second line under the message. Sileo expands the pill into a card for
  // it, the same way it does for an action.
  description?: string;
  // Sticky toasts never auto-dismiss — used for actionable prompts like
  // "New version available". The user must click the action or close it.
  sticky?: boolean;
  action?: ToastAction;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
  // Sugar for the common cases.
  success: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_TTL_MS = 4500;
// Errors stay slightly longer so the user can actually read them.
const ERROR_TTL_MS = 6000;

// Sileo owns the queue, stacking and animation; this context only maps the
// app's small toast vocabulary onto it, and keeps the coalescing behaviour the
// app relies on (a spammed action refreshes one toast instead of stacking).
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // kind+message -> live sileo id, so an identical toast replaces its twin.
  const live = useRef<Map<string, string>>(new Map());

  const value = useMemo<ToastContextValue>(() => {
    const push = (kind: ToastKind, message: string, opts?: ToastOptions) => {
      const key = `${kind}:${message}`;
      if (!opts?.sticky) {
        const prev = live.current.get(key);
        if (prev) sileo.dismiss(prev);
      }
      // Acting on a toast also closes it — the prompt has been answered.
      // Assigned after the call, which is where the id comes from.
      let id = "";
      const action = opts?.action;
      id = sileo[kind]({
        title: message,
        description: opts?.description,
        duration: opts?.sticky ? null : kind === "error" ? ERROR_TTL_MS : TOAST_TTL_MS,
        button: action
          ? {
              title: action.label,
              onClick: () => {
                action.onClick();
                sileo.dismiss(id);
              },
            }
          : undefined,
      });
      if (!opts?.sticky) {
        live.current.set(key, id);
        // Forget the mapping once the toast has gone, so the map can't grow
        // without bound and a later push doesn't dismiss a recycled id.
        const ttl = kind === "error" ? ERROR_TTL_MS : TOAST_TTL_MS;
        window.setTimeout(() => {
          if (live.current.get(key) === id) live.current.delete(key);
        }, ttl + 1000);
      }
      return id;
    };

    return {
      push,
      dismiss: (id: string) => sileo.dismiss(id),
      success: (m: string, o?: ToastOptions) => push("success", m, o),
      error: (m: string, o?: ToastOptions) => push("error", m, o),
      info: (m: string, o?: ToastOptions) => push("info", m, o),
    };
  }, []);

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
