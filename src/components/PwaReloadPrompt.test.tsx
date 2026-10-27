import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PwaReloadPrompt from "./PwaReloadPrompt";
import { useAuth } from "../context/AuthContext";
import { useUpdate } from "../context/UpdateContext";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/UpdateContext", () => ({ useUpdate: vi.fn() }));

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
  beforeEach(() => applyUpdate.mockReset());

  it("asks a signed-in user, naming the new version", () => {
    setup(true, true, "2.1.0");
    render(<PwaReloadPrompt />);
    expect(screen.getByText("Version 2.1.0 is available.")).toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(applyUpdate).toHaveBeenCalled();
  });

  it("updates silently on the sign-in screen", () => {
    setup(false, true);
    render(<PwaReloadPrompt />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
