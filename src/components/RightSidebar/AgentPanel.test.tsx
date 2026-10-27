import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentPanel from "./AgentPanel";
import { sendAgentMessage } from "../../services/agent";

vi.mock("../../services/agent", () => ({ sendAgentMessage: vi.fn() }));
const send = vi.mocked(sendAgentMessage);

describe("AgentPanel", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("sends a suggested prompt when tapped", async () => {
    send.mockResolvedValue({ reply: "Two tasks due.", proposals: [] });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "What's due this week?" }));

    expect(await screen.findByText("Two tasks due.")).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith({ history: [], message: "What's due this week?", year: 2026, semester: "A" });
  });

  it("disables input until a semester is open", () => {
    render(<AgentPanel year={null} semester={null} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "What's overdue?" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Open a semester first")).toBeDisabled();
  });

  it("saves a proposal only after Confirm", async () => {
    const proposal = { course: "calculus", name: "HW 4", dueDate: "2026-11-03", status: "PENDING" as const };
    send.mockResolvedValue({ reply: "I proposed it.", proposals: [proposal] });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "add hw 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("HW 4")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledWith(proposal, 2026, "A");
  });

  it("dismisses a proposal without saving", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "T", dueDate: "2026-11-03", status: "PENDING" }],
    });
    const onConfirm = vi.fn();
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "What's overdue?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows errors and keeps them out of the history sent next", async () => {
    send.mockRejectedValueOnce(new Error("Daily limit of 200 messages reached."));
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "What's overdue?" }));
    expect(await screen.findByText("Daily limit of 200 messages reached.")).toBeInTheDocument();

    send.mockResolvedValueOnce({ reply: "ok", proposals: [] });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ history: [{ role: "user", text: "What's overdue?" }], message: "again" })
    );
  });

  it("renders replies as text, not HTML", async () => {
    send.mockResolvedValue({ reply: '<img src=x onerror="alert(1)">', proposals: [] });
    const { container } = render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "What's overdue?" }));
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
