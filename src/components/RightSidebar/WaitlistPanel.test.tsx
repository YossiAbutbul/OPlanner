import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WaitlistPanel from "./WaitlistPanel";
import { joinWaitlist } from "../../services/agent";

vi.mock("../../services/agent", () => ({ joinWaitlist: vi.fn() }));
const join = vi.mocked(joinWaitlist);

describe("WaitlistPanel", () => {
  beforeEach(() => join.mockReset());

  it("joins the waitlist and reports it", async () => {
    join.mockResolvedValue();
    const onJoined = vi.fn();
    render(<WaitlistPanel waitlisted={false} onJoined={onJoined} />);
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    await vi.waitFor(() => expect(onJoined).toHaveBeenCalled());
  });

  it("shows the server's error and stays joinable", async () => {
    join.mockRejectedValueOnce(new Error("Couldn't join the waitlist. Try again in a moment."));
    render(<WaitlistPanel waitlisted={false} onJoined={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't join");
    expect(await screen.findByRole("button", { name: "Join the waitlist" })).toBeEnabled();
  });

  it("shows the joined state instead of the button", () => {
    render(<WaitlistPanel waitlisted onJoined={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("You're on the waitlist");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
