import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { sileo } from "sileo";
import { ToastProvider, useToast, useToastQueue } from "./ToastContext";

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

// The API and the plain list's queue come from separate contexts; most tests
// only need the API, the phone ones need both.
const renderToast = () =>
  renderHook(() => ({ api: useToast(), toasts: useToastQueue() }), { wrapper });

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

// Phone / installed PWA: sileo stands down, transient toasts are dropped,
// and the prompts that remain go into `toasts` for ToastList to render.
describe("ToastContext on a phone", () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 480px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it("drops transient toasts instead of showing them", () => {
    const { result } = renderToast();

    let id = "x";
    act(() => {
      id = result.current.api.success("Task updated", { description: "Due tomorrow" });
    });
    act(() => void result.current.api.error("Couldn't save"));

    expect(id).toBe("");
    expect(result.current.toasts).toEqual([]);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("keeps a sticky prompt in its own list and dismisses it by id", () => {
    const { result } = renderToast();
    const onClick = vi.fn();

    let id = "";
    act(() => {
      id = result.current.api.info("Update available", {
        description: "Version 9.9.9 is ready.",
        sticky: true,
        action: { label: "Update", onClick },
      });
    });

    expect(sileo.info).not.toHaveBeenCalled();
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      id,
      kind: "info",
      message: "Update available",
      description: "Version 9.9.9 is ready.",
      sticky: true,
    });

    act(() => result.current.api.dismiss(id));
    expect(result.current.toasts).toEqual([]);
    // The plain list owns this id, so sileo is never asked about it.
    expect(sileo.dismiss).not.toHaveBeenCalled();
  });

  it("replaces an identical prompt rather than stacking a second one", () => {
    const { result } = renderToast();

    act(() => void result.current.api.info("Update available", { sticky: true }));
    act(() => void result.current.api.info("Update available", { sticky: true }));

    expect(result.current.toasts).toHaveLength(1);
  });

  // Callers pass success/error/info into effect dependency arrays. If a queued
  // toast reshaped the API, PwaReloadPrompt's effect would re-run, dismiss its
  // prompt and push it again without end (React error #185).
  it("keeps the API identical across a push, so effects that depend on it don't re-run", () => {
    const { result } = renderToast();
    const before = result.current.api;

    act(() => void result.current.api.info("Update available", { sticky: true }));

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.api).toBe(before);
    expect(result.current.api.info).toBe(before.info);
  });
});
