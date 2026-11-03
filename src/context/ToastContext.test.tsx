import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { sileo } from "sileo";
import { ToastProvider, useToast } from "./ToastContext";

// Sileo owns the queue and rendering; these tests cover the mapping this
// context does on top of it (kind, durations, action button, coalescing).
vi.mock("sileo", () => {
  let n = 0;
  const make = () => `sileo-${++n}`;
  return {
    sileo: {
      success: vi.fn(make),
      error: vi.fn(make),
      info: vi.fn(make),
      dismiss: vi.fn(),
    },
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws if useToast used outside provider", () => {
    expect(() => renderHook(() => useToast())).toThrow(/within ToastProvider/);
  });

  it("maps success/error/info onto the matching sileo call", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.success("yay"));
    act(() => void result.current.error("oh no"));
    act(() => void result.current.info("fyi"));

    expect(sileo.success).toHaveBeenCalledWith(expect.objectContaining({ title: "yay" }));
    expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ title: "oh no" }));
    expect(sileo.info).toHaveBeenCalledWith(expect.objectContaining({ title: "fyi" }));
  });

  it("gives errors a longer duration than success/info, and sticky toasts none", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.success("a"));
    act(() => void result.current.error("b"));
    act(() => void result.current.info("c", { sticky: true }));

    expect(vi.mocked(sileo.success).mock.calls[0][0].duration).toBe(4500);
    expect(vi.mocked(sileo.error).mock.calls[0][0].duration).toBe(6000);
    expect(vi.mocked(sileo.info).mock.calls[0][0].duration).toBeNull();
  });

  it("passes an action through as sileo's button", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    const onClick = vi.fn();

    act(() => void result.current.info("Chat cleared", { action: { label: "Undo", onClick } }));

    const opts = vi.mocked(sileo.info).mock.calls[0][0];
    expect(opts.button).toMatchObject({ title: "Undo" });
    opts.button!.onClick();
    expect(onClick).toHaveBeenCalled();
  });

  it("coalesces identical non-sticky toasts by dismissing the live twin", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let first = "";
    act(() => {
      first = result.current.success("Notes saved");
    });
    expect(sileo.dismiss).not.toHaveBeenCalled();

    act(() => void result.current.success("Notes saved"));
    expect(sileo.dismiss).toHaveBeenCalledWith(first);

    // A different message is its own toast, not a replacement.
    vi.mocked(sileo.dismiss).mockClear();
    act(() => void result.current.success("Links saved"));
    expect(sileo.dismiss).not.toHaveBeenCalled();
  });

  it("stops tracking a toast once it has expired, so its id is not reused", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.success("Notes saved"));
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    act(() => void result.current.success("Notes saved"));
    expect(sileo.dismiss).not.toHaveBeenCalled();
  });

  it("dismiss forwards to sileo", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.dismiss("sileo-42"));
    expect(sileo.dismiss).toHaveBeenCalledWith("sileo-42");
  });
});
