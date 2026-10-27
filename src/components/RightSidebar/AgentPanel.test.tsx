import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    fireEvent.click(screen.getByRole("button", { name: "מה יש לי השבוע?" }));

    expect(await screen.findByText("Two tasks due.")).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith(
      { history: [], message: "מה יש לי השבוע?", year: 2026, semester: "A" },
      expect.any(Function)
    );
  });

  it("puts an unfinished suggestion in the input instead of sending it", () => {
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "תיצור לי קורס חדש בשם..." }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("תיצור לי קורס חדש בשם ");
  });

  it("shows what the agent is doing while it works", async () => {
    let finish!: (r: { reply: string; proposals: [] }) => void;
    send.mockImplementation((_input, onStatus) => {
      onStatus?.("Checking your tasks…");
      return new Promise((resolve) => (finish = resolve));
    });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Checking your tasks…");
    act(() => finish({ reply: "Nothing overdue.", proposals: [] }));
    await screen.findByText("Nothing overdue.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables input until a semester is open", () => {
    render(<AgentPanel year={null} semester={null} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "מה פספסתי?" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Open a semester first")).toBeDisabled();
  });

  it("adds a proposed study session to the Schedule after confirming", async () => {
    const proposal = {
      action: "block" as const,
      course: "calculus",
      name: "Study: HW 4",
      dueDate: "2026-11-02",
      startTime: "18:00",
      endTime: "20:00",
      status: "PENDING" as const,
    };
    send.mockResolvedValue({ reply: "Here's a session.", proposals: [proposal] });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "plan my week" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Study session")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add to Schedule" }));
    await waitFor(() => expect(screen.getByText("Added to your Schedule")).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledWith(proposal, 2026, "A");
  });

  it("warns about a deadline with no study time and opens a plan for it", async () => {
    send.mockResolvedValue({ reply: "When are you free?", proposals: [] });
    const due = new Date(Date.now() + 2 * 86_400_000);
    const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    render(
      <AgentPanel
        year={2026}
        semester="A"
        onConfirm={vi.fn()}
        liveTasks={{ year: 2026, semester: "A", tasks: [{ id: "t1", name: "מטלה 11", course: "אלגוריתמים", dueDate: iso, status: "PENDING" }] }}
        blocks={[]}
      />
    );
    expect(screen.getByText("בעוד 2 ימים · אין זמן לימוד ביומן")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /תכנן לי/ }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0].message).toContain("תעזור לי לתכנן זמן למטלה 11");
  });

  it("asks whether a missed task was handed in and marks it done on yes", async () => {
    const onConfirm = vi.fn().mockResolvedValue("t1");
    const past = new Date(Date.now() - 86_400_000);
    const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
    render(
      <AgentPanel
        year={2026}
        semester="A"
        onConfirm={onConfirm}
        liveTasks={{ year: 2026, semester: "A", tasks: [{ id: "t1", name: "מטלה 11", course: "אלגוריתמים", dueDate: iso, status: "PENDING" }] }}
      />
    );
    expect(screen.getByText("הגשת את מטלה 11 באלגוריתמים? ההגשה הייתה אתמול.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "כן, הגשתי" }));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", status: "DONE" }), 2026, "A")
    );
    await waitFor(() => expect(screen.queryByText(/הגשת את מטלה 11/)).not.toBeInTheDocument());
    expect(send).not.toHaveBeenCalled();
  });

  it("turns the reply's likely answers into buttons", async () => {
    send.mockResolvedValueOnce({ reply: "When are you free?\n[[Evenings | Weekend]]", proposals: [] });
    send.mockResolvedValueOnce({ reply: "Got it.", proposals: [] });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "בוא נתכנן את השבוע הקרוב" }));

    expect(await screen.findByText("When are you free?")).toBeInTheDocument();
    expect(screen.queryByText(/\[\[/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weekend" }));
    expect(await screen.findByText("Got it.")).toBeInTheDocument();
    expect(send.mock.calls[1][0].message).toBe("Weekend");
    expect(screen.queryByRole("button", { name: "Evenings" })).not.toBeInTheDocument();
  });

  it("saves a proposal only after Add task", async () => {
    const proposal = { course: "calculus", name: "HW 4", dueDate: "2026-11-03", status: "PENDING" as const };
    send.mockResolvedValue({ reply: "I proposed it.", proposals: [proposal] });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "add hw 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("HW 4")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(screen.getByText("Added to your planner")).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledWith(proposal, 2026, "A");
  });

  it("dismisses a proposal without saving", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "T", dueDate: "2026-11-03", status: "PENDING" }],
    });
    const onConfirm = vi.fn();
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows errors and keeps them out of the history sent next", async () => {
    send.mockRejectedValueOnce(new Error("Daily limit of 200 messages reached."));
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByText("Daily limit of 200 messages reached.")).toBeInTheDocument();

    send.mockResolvedValueOnce({ reply: "ok", proposals: [] });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ history: [{ role: "user", text: "מה פספסתי?" }], message: "again" }),
      expect.any(Function)
    );
  });

  it("retries a failed message without sending it twice", async () => {
    send.mockRejectedValueOnce(new Error("Couldn't reach the assistant."));
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the assistant.");

    send.mockResolvedValueOnce({ reply: "Nothing overdue.", proposals: [] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Nothing overdue.");
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ history: [], message: "מה פספסתי?" }),
      expect.any(Function)
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("מה פספסתי?")).toHaveLength(1);
  });

  it("keeps the last chat across reloads and expires unanswered proposals", async () => {
    localStorage.clear();
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "Old task", dueDate: "2026-11-03", status: "PENDING" }],
    });
    const first = render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} storageKey="oplanner.agentChat.u1" />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    await screen.findByText("Old task");
    first.unmount();

    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} storageKey="oplanner.agentChat.u1" />);
    expect(screen.getByText("Proposed.")).toBeInTheDocument();
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
  });

  it("brings a cleared chat back on undo", async () => {
    localStorage.clear();
    send.mockResolvedValue({ reply: "Nothing overdue.", proposals: [] });
    let undo: (() => void) | undefined;
    render(
      <AgentPanel year={2026} semester="A" onConfirm={vi.fn()} storageKey="k" onCleared={(u) => (undo = u)} />
    );
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    await screen.findByText("Nothing overdue.");

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("Nothing overdue.")).toBeNull();
    expect(localStorage.getItem("k")).toBeNull();

    act(() => undo!());
    expect(screen.getByText("Nothing overdue.")).toBeInTheDocument();
  });

  it("shows a delete card that deletes only on confirm", async () => {
    const proposal = { action: "delete" as const, id: "t1", course: "x", name: "Old HW", dueDate: "2026-11-03", status: "PENDING" as const };
    send.mockResolvedValue({ reply: "Proposed.", proposals: [proposal] });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    expect(await screen.findByText("Delete task")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByText("Deleted")).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledWith(proposal, 2026, "A");
  });

  it("shows a status-only change to done as Mark done", async () => {
    const prev = { course: "x", name: "HW", dueDate: "2026-11-03", status: "PENDING" };
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ id: "t1", course: "x", name: "HW", dueDate: "2026-11-03", status: "DONE", prev }],
    });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByRole("button", { name: "Mark done" })).toBeInTheDocument();
    expect(screen.queryByText("Status")).toBeNull();
  });

  it("confirms every pending card with Add all", async () => {
    const p = (name: string) => ({ course: "x", name, dueDate: "2026-11-03", status: "PENDING" as const });
    send.mockResolvedValue({ reply: "A plan.", proposals: [p("A"), p("B"), p("C")] });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    fireEvent.click((await screen.findAllByRole("button", { name: "Dismiss" }))[1]);
    fireEvent.click(screen.getByRole("button", { name: "Add all 2" }));
    await waitFor(() => expect(screen.getAllByText("Added to your planner")).toHaveLength(2));
    expect(onConfirm.mock.calls.map((c) => c[0].name)).toEqual(["A", "C"]);
  });

  it("keeps a saved card in step with the task in the planner", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "Doctor", dueDate: "2026-10-29", status: "PENDING" }],
    });
    const onConfirm = vi.fn().mockResolvedValue("new-id");
    const live = (tasks: { id: string; name: string }[]) => ({
      year: 2026,
      semester: "A",
      tasks: tasks.map((t) => ({ ...t, course: "x", dueDate: "2026-10-30", status: "PENDING" })),
    });
    // The planner shows a saved task at once (optimistic save).
    const { rerender } = render(
      <AgentPanel year={2026} semester="A" onConfirm={onConfirm} liveTasks={live([{ id: "new-id", name: "Doctor" }])} />
    );
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add task" }));
    await screen.findByText("Added to your planner");

    // Renamed and moved in the planner: the card shows it.
    rerender(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} liveTasks={live([{ id: "new-id", name: "Dentist" }])} />);
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    expect(screen.getByText(/Fri, Oct 30/)).toBeInTheDocument();

    // Deleted in the planner: the card says so.
    rerender(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} liveTasks={live([])} />);
    expect(screen.getByText("No longer in your planner")).toBeInTheDocument();
  });

  it("can't confirm a suggestion for a task that was deleted meanwhile", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ action: "delete", id: "t1", course: "x", name: "Gone", dueDate: "2026-11-03", status: "PENDING" }],
    });
    render(
      <AgentPanel year={2026} semester="A" onConfirm={vi.fn()} liveTasks={{ year: 2026, semester: "A", tasks: [] }} />
    );
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByText("No longer in your planner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("doesn't mark cards gone while tasks are still loading", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ action: "delete", id: "t1", course: "x", name: "T", dueDate: "2026-11-03", status: "PENDING" }],
    });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("recalls sent messages with the arrow keys and keeps them in this browser", async () => {
    localStorage.clear();
    send.mockResolvedValue({ reply: "ok", proposals: [] });
    const first = render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} storageKey="k" />);
    const box = () => screen.getByRole("textbox") as HTMLTextAreaElement;
    const ask = async (text: string) => {
      fireEvent.change(box(), { target: { value: text } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeDisabled());
      await screen.findAllByText("ok");
    };
    await ask("first");
    await ask("second");
    first.unmount();

    // A reload keeps the history (localStorage only).
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} storageKey="k" />);
    expect(JSON.parse(localStorage.getItem("k.sent")!)).toEqual(["first", "second"]);

    fireEvent.change(box(), { target: { value: "draft" } });
    box().setSelectionRange(0, 0);
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(box().value).toBe("second");
    expect(screen.getByText("History 2/2")).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(box().value).toBe("first");
    expect(screen.getByText("History 1/2")).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(box().value).toBe("second");
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(box().value).toBe("draft");
    expect(screen.getByText(/^History/)).not.toHaveClass("is-on");
  });

  it("asks for a missing end time on the card before adding", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "Doctor", dueDate: "2026-10-29", startTime: "18:00", status: "PENDING" }],
    });
    const onConfirm = vi.fn().mockResolvedValue("id1");
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    expect(await screen.findByText("Pick an end time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("End"), { target: { value: "17:00" } });
    expect(screen.getByText("End time must be after the start.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("End"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await screen.findByText("Added to your planner");
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ name: "Doctor", startTime: "18:00", endTime: "18:30" });
  });

  it("lets the user edit a complete suggestion before adding", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "Read", dueDate: "2026-10-29", status: "PENDING" }],
    });
    const onConfirm = vi.fn().mockResolvedValue("id1");
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Read chapter 3" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await screen.findByText("Added to your planner");
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ name: "Read chapter 3", dueDate: "2026-10-30" });
    expect(onConfirm.mock.calls[0][0]).not.toHaveProperty("startTime");
  });

  it("proposes a course and asks for the final date if it's missing", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ action: "course", course: "Linear Algebra", name: "Linear Algebra", dueDate: "", status: "PENDING" }],
    });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    expect(await screen.findByText("New course")).toBeInTheDocument();
    expect(screen.getByText("No final exam date")).toBeInTheDocument();
    // Optional, so adding isn't blocked; the field is there to fill.
    expect(screen.getByRole("button", { name: "Add course" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Final exam (optional)"), { target: { value: "2027-02-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add course" }));
    await screen.findByText("Course added");
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ action: "course", name: "Linear Algebra", dueDate: "2027-02-10" });
  });

  it("never deletes through Confirm all", async () => {
    const del = (id: string) => ({ action: "delete" as const, id, course: "x", name: id, dueDate: "2026-11-03", status: "PENDING" as const });
    const add = (name: string) => ({ course: "x", name, dueDate: "2026-11-03", status: "PENDING" as const });
    send.mockResolvedValue({ reply: "Proposed.", proposals: [del("a"), add("B"), del("c"), add("D")] });
    const onConfirm = vi.fn().mockResolvedValue("id");
    render(<AgentPanel year={2026} semester="A" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));

    fireEvent.click(await screen.findByRole("button", { name: "Add all 2" }));
    await waitFor(() => expect(screen.getAllByText("Added to your planner")).toHaveLength(2));
    expect(onConfirm.mock.calls.map((c) => c[0].name)).toEqual(["B", "D"]);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("shows which semester a card writes to after switching semesters", async () => {
    send.mockResolvedValue({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "HW", dueDate: "2026-11-03", status: "PENDING" }],
    });
    const { rerender } = render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByText("New task")).toBeInTheDocument();
    rerender(<AgentPanel year={2026} semester="B" onConfirm={vi.fn()} />);
    expect(screen.getByText("New task · A 2026")).toBeInTheDocument();
  });

  it("closes Edit with Done and keeps the changes", async () => {
    send.mockResolvedValue({ reply: "Proposed.", proposals: [{ course: "x", name: "Read", dueDate: "2026-10-29", status: "PENDING" }] });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Read ch. 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByText("Read ch. 3")).toBeInTheDocument();
  });

  it("brings a dismissed card back with Undo", async () => {
    send.mockResolvedValue({ reply: "Proposed.", proposals: [{ course: "x", name: "HW", dueDate: "2026-10-29", status: "PENDING" }] });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();
  });

  it("tells the agent what happened to each card", async () => {
    send.mockResolvedValueOnce({
      reply: "Proposed.",
      proposals: [{ course: "x", name: "HW 1", dueDate: "2026-10-29", status: "PENDING" }],
    });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    send.mockResolvedValueOnce({ reply: "ok", proposals: [] });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    const history = send.mock.lastCall![0].history;
    expect(history[1].text).toContain('[App note: the new task suggestion "HW 1" (2026-10-29) was dismissed.]');
  });

  it("asks for a missing date on the card", async () => {
    send.mockResolvedValue({ reply: "Proposed.", proposals: [{ course: "x", name: "HW", dueDate: "", status: "PENDING" }] });
    render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByText("No date yet")).toBeInTheDocument();
    expect(screen.getByText("Pick a date.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-29" } });
    expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();
  });

  it("renders replies as text, not HTML", async () => {
    send.mockResolvedValue({ reply: '<img src=x onerror="alert(1)">', proposals: [] });
    const { container } = render(<AgentPanel year={2026} semester="A" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "מה פספסתי?" }));
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
