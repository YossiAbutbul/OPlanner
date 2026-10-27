import { describe, expect, it } from "vitest";
import { pickNudge, splitQuickReplies, type NudgeTask } from "./nudges";

const now = new Date(2026, 9, 27, 12); // Tuesday, Oct 27, 2026
const task = (over: Partial<NudgeTask>): NudgeTask => ({
  id: "t1",
  name: "מטלה 11",
  course: "אלגוריתמים",
  dueDate: "2026-10-26",
  status: "PENDING",
  ...over,
});

describe("pickNudge", () => {
  it("asks about a task whose date just passed", () => {
    const n = pickNudge([task({})], now, new Set());
    expect(n?.kind).toBe("submitted");
    expect(n?.text).toBe("סיימת את מטלה 11 באלגוריתמים? התאריך היה אתמול.");
    expect(n?.kind === "submitted" && n.catchUp).toContain("עוד לא סיימתי את מטלה 11");
  });

  it("asks about the most recent miss first, and skips answered ones", () => {
    const tasks = [task({ id: "a", dueDate: "2026-10-20" }), task({ id: "b", dueDate: "2026-10-25" })];
    expect(pickNudge(tasks, now, new Set())?.key).toBe("s|b|2026-10-25");
    expect(pickNudge(tasks, now, new Set(["s|b|2026-10-25"]))?.key).toBe("s|a|2026-10-20");
  });

  it("leaves done and long-past tasks alone", () => {
    const tasks = [task({ status: "DONE" }), task({ id: "old", dueDate: "2026-09-01" })];
    expect(pickNudge(tasks, now, new Set())).toBeNull();
  });

  it("opens the week with what's due, once", () => {
    const tasks = [task({ dueDate: "2026-10-29" }), task({ id: "t2", dueDate: "2026-10-30" })];
    const n = pickNudge(tasks, now, new Set());
    expect(n?.kind).toBe("week");
    expect(n?.text).toBe("שבוע חדש: 2 משימות השבוע, הקרוב ביום חמישי. נתכנן?");
    expect(pickNudge(tasks, now, new Set([n!.key]))).toBeNull();
  });

  it("never asks whether an exam was done, and calls it an exam", () => {
    const exam = task({ id: "final-exam", name: "Final Exam – אלגוריתמים", dueDate: "2026-10-26" });
    expect(pickNudge([exam], now, new Set())).toBeNull();
    const soon = task({ id: "final-exam", name: "Final Exam – אלגוריתמים", dueDate: "2026-10-29" });
    expect(pickNudge([soon], now, new Set())?.text).toBe("שבוע חדש: מבחן באלגוריתמים ביום חמישי. נתכנן?");
    const mixed = [soon, task({ dueDate: "2026-10-30" })];
    expect(pickNudge(mixed, now, new Set())?.text).toBe("שבוע חדש: משימה אחת ומבחן השבוע, הקרוב ביום חמישי. נתכנן?");
  });

  it("says nothing about an empty week", () => {
    expect(pickNudge([task({ dueDate: "2026-11-20" })], now, new Set())).toBeNull();
  });
});

describe("splitQuickReplies", () => {
  it("turns the last line into buttons", () => {
    expect(splitQuickReplies("When are you free?\n[[Evenings | Weekend]]")).toEqual({
      text: "When are you free?",
      groups: [{ options: ["Evenings", "Weekend"] }],
    });
  });

  it("reads one labeled line per question", () => {
    const { text, groups } = splitQuickReplies("1. Days?\n2. Length?\n[[Days: Evenings | Weekend]]\n[[Length: 1h | 2h]]");
    expect(text).toBe("1. Days?\n2. Length?");
    expect(groups).toEqual([
      { label: "Days", options: ["Evenings", "Weekend"] },
      { label: "Length", options: ["1h", "2h"] },
    ]);
  });

  it("leaves other text as is", () => {
    expect(splitQuickReplies("No question here.")).toEqual({ text: "No question here.", groups: [] });
  });
});
