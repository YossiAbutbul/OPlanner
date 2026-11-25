import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster, sileo } from "sileo";
import { installToastClose } from "./toastClose";

// jsdom has no ResizeObserver; sileo measures its pill with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Runs against the real sileo: the close button depends on how it renders a
// toast, so an upgrade that changes that should fail here, not in the app.
describe("toast close button", () => {
  let uninstall: (() => void) | undefined;
  afterEach(() => {
    uninstall?.();
    vi.restoreAllMocks();
    act(() => sileo.clear());
  });

  it("gives a sileo toast an x that dismisses that toast", async () => {
    const { container } = render(<Toaster position="bottom-right" />);
    uninstall = installToastClose();
    const dismiss = vi.spyOn(sileo, "dismiss");

    let id = "";
    act(() => {
      id = sileo.success({ title: "Task added", duration: null });
    });

    const x = await waitFor(() => {
      const el = container.ownerDocument.querySelector("[data-sileo-toast] > .sileo-close");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(x.getAttribute("aria-label")).toBe("Dismiss notification");

    fireEvent.click(x);
    expect(dismiss).toHaveBeenCalledWith(id);
  });
});
