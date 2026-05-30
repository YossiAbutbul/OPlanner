import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { ToastProvider, useToast } from "./ToastContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws if useToast used outside provider", () => {
    // renderHook without wrapper should make the hook throw on mount.
    expect(() => renderHook(() => useToast())).toThrow(/within ToastProvider/);
  });

  it("push adds a toast; success/error/info sugar work", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toHaveLength(0);

    act(() => result.current.success("yay"));
    act(() => result.current.error("oh no"));
    act(() => result.current.info("fyi"));

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0]).toMatchObject({ kind: "success", message: "yay" });
    expect(result.current.toasts[1]).toMatchObject({ kind: "error", message: "oh no" });
    expect(result.current.toasts[2]).toMatchObject({ kind: "info", message: "fyi" });
    // Ids must be unique.
    const ids = result.current.toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("auto-dismisses success/info after 4.5s, errors after 6s", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.success("a"));
    act(() => result.current.error("b"));

    // At 4.5s, success is gone but error stays.
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(result.current.toasts.map((t) => t.kind)).toEqual(["error"]);

    // At 6s total, error is also gone.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismiss removes the toast immediately", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.success("a"));
    const id = result.current.toasts[0].id;
    act(() => result.current.dismiss(id));
    expect(result.current.toasts).toHaveLength(0);
  });
});
