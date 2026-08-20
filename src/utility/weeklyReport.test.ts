import { describe, expect, it } from "vitest";
import {
  buildWeeklyReport,
  weeklyTrend,
  fmtMinutes,
  fmtSpan,
  latenessMinutes,
  PERSONAL_BUCKET,
  shiftWeeks,
  taskMinutes,
  weekDays,
  weekLabel,
  weekStartOf,
} from "./weeklyReport";
import type { CourseInfo, HomeworkEntry, TimeBlock } from "../types/models";

// Week under test: Sun 2026-08-09 → Sat 2026-08-15.
const WEEK = "2026-08-09";
const NOW = new Date(2026, 7, 15, 12, 0, 0); // Sat 15 Aug 2026, midday

const courses: CourseInfo[] = [
  { name: "signals", finalDate: "2026-09-07" },
  { name: "algebra" },
];

const task = (over: Partial<HomeworkEntry> & Pick<HomeworkEntry, "id" | "dueDate">): HomeworkEntry => ({
  name: `task ${over.id}`,
  status: "PENDING",
  year: 2026,
  semester: "b",
  course: "signals",
  ...over,
} as HomeworkEntry);

const block = (over: Partial<TimeBlock> & Pick<TimeBlock, "id" | "date">): TimeBlock => ({
  startTime: "10:00",
  endTime: "12:00",
  title: `block ${over.id}`,
  ...over,
} as TimeBlock);

describe("week helpers", () => {
  it("starts weeks on Sunday", () => {
    // Wed 12 Aug 2026 → Sun 9 Aug 2026
    expect(weekStartOf(new Date(2026, 7, 12)).getDay()).toBe(0);
    expect(weekDays(WEEK)).toEqual([
      "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
      "2026-08-13", "2026-08-14", "2026-08-15",
    ]);
  });

  it("shifts weeks across month boundaries", () => {
    expect(shiftWeeks(WEEK, -1)).toBe("2026-08-02");
    expect(shiftWeeks("2026-08-30", 1)).toBe("2026-09-06");
  });

  it("labels same-month and cross-month weeks differently", () => {
    expect(weekLabel(WEEK)).toContain("9–15");
    expect(weekLabel("2026-08-30")).toContain("–");
  });

  it("formats durations and spans", () => {
    expect(fmtMinutes(45)).toBe("45m");
    expect(fmtMinutes(120)).toBe("2h");
    expect(fmtMinutes(95)).toBe("1h 35m");
    expect(fmtSpan(3300)).toBe("2d 7h");
  });
});

describe("taskMinutes", () => {
  it("counts a timed window", () => {
    expect(taskMinutes(task({ id: "a", dueDate: WEEK, startTime: "09:00", endTime: "10:30" }))).toBe(90);
  });

  it("ignores all-day and untimed tasks", () => {
    expect(taskMinutes(task({ id: "b", dueDate: WEEK }))).toBe(0);
    expect(taskMinutes(task({ id: "c", dueDate: WEEK, startTime: "07:00", endTime: "23:00" }))).toBe(0);
  });
});

describe("latenessMinutes", () => {
  it("is positive past the deadline, negative before it", () => {
    const late = task({
      id: "l", dueDate: "2026-08-10", endTime: "12:00",
      completedAt: new Date(2026, 7, 10, 14, 0).toISOString(),
    });
    expect(latenessMinutes(late)).toBe(120);

    const early = task({
      id: "e", dueDate: "2026-08-10", endTime: "12:00",
      completedAt: new Date(2026, 7, 10, 9, 0).toISOString(),
    });
    expect(latenessMinutes(early)).toBe(-180);
  });

  it("is null without a stamp", () => {
    expect(latenessMinutes(task({ id: "n", dueDate: WEEK, status: "COMPLETED" }))).toBeNull();
  });
});

describe("buildWeeklyReport", () => {
  const tasks: HomeworkEntry[] = [
    // on time, inside the week
    task({
      id: "1", dueDate: "2026-08-10", endTime: "23:00", status: "COMPLETED",
      startTime: "21:00",
      completedAt: new Date(2026, 7, 10, 20, 0).toISOString(),
    }),
    // late by 2h
    task({
      id: "2", dueDate: "2026-08-11", endTime: "12:00", status: "COMPLETED",
      completedAt: new Date(2026, 7, 11, 14, 0).toISOString(),
      course: "algebra",
    }),
    // due this week, still pending and past → overdue
    task({ id: "3", dueDate: "2026-08-12", status: "PENDING" }),
    // completed before completedAt existed
    task({ id: "4", dueDate: "2026-08-13", status: "COMPLETED" }),
    // next week's load
    task({ id: "5", dueDate: "2026-08-18", status: "PENDING", course: "algebra" }),
    task({ id: "6", dueDate: "2026-08-18", status: "PENDING" }),
    // previous week, completed on time
    task({
      id: "7", dueDate: "2026-08-05", endTime: "12:00", status: "COMPLETED",
      completedAt: new Date(2026, 7, 5, 10, 0).toISOString(),
    }),
  ];

  const blocks: TimeBlock[] = [
    block({ id: "b1", date: "2026-08-10", startTime: "09:00", endTime: "11:00", courseId: "signals" }),
    block({ id: "b2", date: "2026-08-12", startTime: "14:00", endTime: "15:30", courseId: "algebra" }),
    // no course → personal bucket
    block({ id: "b3", date: "2026-08-12", startTime: "18:00", endTime: "18:30" }),
    // a course from another semester falls into the personal bucket too
    block({ id: "b4", date: "2026-08-13", startTime: "08:00", endTime: "09:00", courseId: "thermo" }),
    // outside the week
    block({ id: "b5", date: "2026-08-20", startTime: "08:00", endTime: "10:00" }),
  ];

  const report = buildWeeklyReport({ tasks, blocks, courses, weekStart: WEEK, now: NOW });

  it("counts completions by when they were finished", () => {
    // #1 and #2 by their stamp, #4 by its due date (finished before stamps existed)
    expect(report.completed).toBe(3);
    expect(report.due).toBe(4);
    expect(report.dueDone).toBe(3);
    expect(report.completionPct).toBe(75);
  });

  it("splits on time vs late", () => {
    expect(report.onTime).toBe(1);
    expect(report.late).toBe(1);
    expect(report.lateMinutes).toBe(120);
    expect(report.avgLateMinutes).toBe(120);
    expect(report.onTimePct).toBe(50);
    expect(report.unfinished).toBe(1);
    expect(report.unstamped).toBe(1);
  });

  it("adds up blocked time and splits it by course", () => {
    // blocks 120 + 90 + 30 + 60, plus task #1's 2h window
    expect(report.minutes).toBe(420);
    const map = Object.fromEntries(report.byCourse.map((c) => [c.course, c.minutes]));
    expect(map.signals).toBe(240);
    expect(map.algebra).toBe(90);
    expect(map[PERSONAL_BUCKET]).toBe(90);
    expect(report.byCourse[0].course).toBe("signals");
  });

  it("fills the seven-day chart and picks the best day", () => {
    expect(report.byDay).toHaveLength(7);
    expect(report.byDay[4].completed).toBe(1); // #4, placed on its due date
    expect(report.byDay[1].minutes).toBe(240); // Mon: block + task window
    expect(report.byDay[1].completed).toBe(1);
    expect(report.bestDay?.iso).toBe("2026-08-10");
  });

  it("lists open overdue tasks with their age", () => {
    expect(report.overdue.map((o) => o.task.id)).toEqual(["3"]);
    expect(report.overdue[0].daysOver).toBe(3);
    expect(report.overdueDays).toBe(3);
  });

  it("previews next week and upcoming finals", () => {
    expect(report.nextWeekTotal).toBe(2);
    expect(report.nextWeekDue[2].completed).toBe(2); // Tue 18 Aug
    expect(report.exams).toEqual([
      { course: "signals", date: "2026-09-07", daysLeft: 23 },
    ]);
  });

  it("compares against the previous week", () => {
    expect(report.prev.completed).toBe(1);
    expect(report.delta.completed).toBe(2);
    expect(report.prev.onTimePct).toBe(100);
    expect(report.delta.onTimePct).toBe(-50);
  });

  it("marks the on-time split unreliable while old completions dominate", () => {
    // one stamped completion against three legacy ones
    const legacy = ["2026-08-10", "2026-08-11", "2026-08-12"].map((d, i) =>
      task({ id: `old${i}`, dueDate: d, status: "COMPLETED" })
    );
    const mixed = buildWeeklyReport({
      tasks: [tasks[1], ...legacy], blocks: [], courses, weekStart: WEEK, now: NOW,
    });
    expect(mixed.unstamped).toBe(3);
    expect(mixed.tracked).toBe(1);
    expect(mixed.onTimeReliable).toBe(false);

    // once stamped completions catch up, the split counts again
    expect(report.onTimeReliable).toBe(true);
  });

  it("counts tasks per course alongside their time", () => {
    const signals = report.byCourse.find((c) => c.course === "signals");
    expect(signals).toMatchObject({ due: 3, done: 2 });
    const algebra = report.byCourse.find((c) => c.course === "algebra");
    expect(algebra).toMatchObject({ due: 1, done: 1 });
  });

  it("lists open deadlines inside the next seven days", () => {
    // #5 and #6 are due 18 Aug, three days after NOW
    expect(report.upcoming.map((t) => t.id).sort()).toEqual(["5", "6"]);
  });

  it("builds a six week trend ending on the reported week", () => {
    const t = weeklyTrend(tasks, blocks, WEEK, 6);
    expect(t).toHaveLength(6);
    expect(t[5].weekStart).toBe(WEEK);
    expect(t[4].weekStart).toBe("2026-08-02");
    expect(t[5].completed).toBe(report.completed);
    expect(t[4].completed).toBe(report.prev.completed);
  });

  it("handles an empty semester without dividing by zero", () => {
    const blank = buildWeeklyReport({ tasks: [], blocks: [], courses: [], weekStart: WEEK, now: NOW });
    expect(blank.completionPct).toBe(0);
    expect(blank.onTimePct).toBeNull();
    expect(blank.byCourse).toEqual([]);
    expect(blank.bestDay).toBeNull();
    expect(blank.delta.onTimePct).toBeNull();
  });
});
