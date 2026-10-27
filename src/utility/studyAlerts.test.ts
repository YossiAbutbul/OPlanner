import { describe, expect, it } from "vitest";
import { studyAlerts, type AlertBlock, type AlertTask } from "./studyAlerts";

const now = new Date(2026, 9, 27, 12); // Oct 27, 2026
const task = (over: Partial<AlertTask>): AlertTask => ({
  name: "מטלה 11",
  course: "אלגוריתמים",
  dueDate: "2026-10-30",
  status: "PENDING",
  ...over,
});

describe("studyAlerts", () => {
  it("flags a deadline within 5 days with no study time", () => {
    const [a] = studyAlerts([task({})], [], now);
    expect(a.label).toBe("בעוד 3 ימים · אין זמן לימוד ביומן");
    expect(a.title).toBe("מטלה 11 · אלגוריתמים");
    expect(a.prompt).toContain("תעזור לי לתכנן זמן");
  });

  it("is quiet once a study block for the course is planned before it", () => {
    const blocks: AlertBlock[] = [{ date: "2026-10-29", title: "Study: part A", courseId: "אלגוריתמים" }];
    expect(studyAlerts([task({})], blocks, now)).toEqual([]);
  });

  it("doesn't count lectures, past blocks or blocks after the deadline as study time", () => {
    const blocks: AlertBlock[] = [
      { date: "2026-10-28", title: "מפגש · אלגוריתמים", courseId: "2027|Semester A|אלגוריתמים" },
      { date: "2026-10-20", title: "Study", courseId: "אלגוריתמים" },
      { date: "2026-11-02", title: "Study", courseId: "אלגוריתמים" },
    ];
    expect(studyAlerts([task({})], blocks, now)).toHaveLength(1);
  });

  it("ignores done, far-off and past tasks", () => {
    const tasks = [
      task({ status: "DONE" }),
      task({ dueDate: "2026-11-20" }),
      task({ dueDate: "2026-10-20" }),
    ];
    expect(studyAlerts(tasks, [], now)).toEqual([]);
  });

  it("warns about several deadlines on one day", () => {
    const tasks = [
      task({ dueDate: "2026-11-08", name: "מטלה 01", course: "Java" }),
      task({ dueDate: "2026-11-08", name: "מטלה 01" }),
    ];
    const [a] = studyAlerts(tasks, [], now);
    expect(a.label).toBe("2 משימות ב-8/11");
    expect(a.title).toBe("Java, אלגוריתמים");
  });

  it("shows the most urgent first, at most two", () => {
    const tasks = [
      task({ dueDate: "2026-10-31", name: "B" }),
      task({ dueDate: "2026-10-28", name: "A" }),
      task({ dueDate: "2026-10-29", name: "C" }),
    ];
    const alerts = studyAlerts(tasks, [], now);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].title).toContain("A ");
    expect(alerts[0].label).toContain("מחר");
  });
});
