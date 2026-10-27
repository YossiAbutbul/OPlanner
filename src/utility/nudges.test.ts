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
    expect(n?.text).toBe("הגשת את מטלה 11 באלגוריתמים? ההגשה הייתה אתמול.");
    expect(n?.kind === "submitted" && n.catchUp).toContain("עוד לא הגשתי את מטלה 11");
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
    expect(n?.text).toBe("שבוע חדש: 2 הגשות השבוע, הראשונה ביום חמישי. נתכנן?");
    expect(pickNudge(tasks, now, new Set([n!.key]))).toBeNull();
  });

  it("says nothing about an empty week", () => {
    expect(pickNudge([task({ dueDate: "2026-11-20" })], now, new Set())).toBeNull();
  });
});

describe("splitQuickReplies", () => {
  it("turns the last line into buttons", () => {
    expect(splitQuickReplies("מתי אתה פנוי?\n[[ערבים | סופ\"ש | בוקר]]")).toEqual({
      text: "מתי אתה פנוי?",
      replies: ["ערבים", "סופ\"ש", "בוקר"],
    });
  });

  it("leaves other text as is", () => {
    expect(splitQuickReplies("No question here.")).toEqual({ text: "No question here.", replies: [] });
  });
});
