import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PwaReloadPrompt from "./PwaReloadPrompt";
import { useAuth } from "../context/AuthContext";
import { useUpdate } from "../context/UpdateContext";
import type { ToastOptions } from "../context/ToastContext";

const info = vi.fn<(message: string, opts?: ToastOptions) => string>(() => "t1");
const dismiss = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/UpdateContext", () => ({ useUpdate: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ info, dismiss }) }));

const applyUpdate = vi.fn();
const setup = (signedIn: boolean, needRefresh: boolean, nextVersion: string | null = null) => {
  vi.mocked(useAuth).mockReturnValue({ user: signedIn ? { uid: "u" } : null, loading: false } as never);
  vi.mocked(useUpdate).mockReturnValue({
    version: "2.0.0",
    needRefresh,
    nextVersion,
    applyUpdate,
    checkForUpdates: vi.fn(),
  });
};

describe("PwaReloadPrompt", () => {
  beforeEach(() => {
    applyUpdate.mockReset();
    info.mockClear();
    dismiss.mockClear();
  });

  it("asks a signed-in user with a sticky toast naming the new version", () => {
    setup(true, true, "2.1.0");
    const { unmount } = render(<PwaReloadPrompt />);
    expect(info).toHaveBeenCalledTimes(1);
    const [title, opts] = info.mock.calls[0];
    expect(title).toBe("Update available");
    expect(opts?.description).toContain("2.1.0");
    expect(opts?.sticky).toBe(true);
    expect(applyUpdate).not.toHaveBeenCalled();
    opts?.action?.onClick();
    expect(applyUpdate).toHaveBeenCalled();
    unmount();
    expect(dismiss).toHaveBeenCalledWith("t1");
  });

  it("updates silently on the sign-in screen", () => {
    setup(false, true);
    render(<PwaReloadPrompt />);
    expect(info).not.toHaveBeenCalled();
    expect(applyUpdate).toHaveBeenCalled();
  });

  it("waits while a sign-in field is being typed in", () => {
    vi.useFakeTimers();
    setup(false, true);
    render(<input aria-label="Email" />);
    const field = screen.getByLabelText("Email");
    field.focus();
    render(<PwaReloadPrompt />);
    expect(applyUpdate).not.toHaveBeenCalled();

    field.blur();
    vi.runAllTimers();
    expect(applyUpdate).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows nothing without an update", () => {
    setup(true, false);
    render(<PwaReloadPrompt />);
    expect(info).not.toHaveBeenCalled();
  });
});
