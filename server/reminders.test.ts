import { describe, expect, it } from "vitest";
import {
  buildReminders,
  candidateDates,
  isAllowedEndpoint,
  planMessages,
  wallClock,
  type Reminder,
} from "./reminders";

// Wall clock helper: UTC fields hold the local time.
const at = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00Z`);

describe("wallClock", () => {
  it("shifts UTC into the device zone", () => {
    const now = new Date("2026-10-26T21:30:00Z");
    expect(wallClock(now, "Asia/Jerusalem").toISOString()).toBe("2026-10-26T23:30:00.000Z");
    expect(wallClock(now, "America/New_York").toISOString()).toBe("2026-10-26T17:30:00.000Z");
  });

  it("throws on an unknown zone", () => {
    expect(() => wallClock(new Date(), "Not/AZone")).toThrow(RangeError);
  });
});

describe("candidateDates", () => {
  it("covers yesterday through the day after tomorrow in UTC", () => {
    expect(candidateDates(new Date("2026-10-26T12:00:00Z"))).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });
});

describe("buildReminders", () => {
  const tasks = [
    { id: "a", name: "HW 3", dueDate: "2026-10-27" },
    { id: "b", name: "Lab", dueDate: "2026-10-26", startTime: "14:00" },
    { id: "final-exam", name: "Final", dueDate: "2026-10-27" },
  ];
  const finals = [{ course: "Calculus", finalDate: "2026-10-27" }];

  it("holds dated reminders until the evening before", () => {
    const r = buildReminders({ wall: at("2026-10-26", "10:00"), tasks, finals, leadMinutes: 15 });
    expect(r.filter((x) => x.kind === "dated")).toEqual([]);
  });

  it("sends due-tomorrow and exam-tomorrow in the evening, skipping final-exam tasks", () => {
    const r = buildReminders({ wall: at("2026-10-26", "18:05"), tasks, finals, leadMinutes: 15 });
    expect(r.map((x) => x.key)).toEqual(["exam|Calculus|2026-10-27", "due1|a|2026-10-27"]);
  });

  it("fires the start reminder only inside the lead window", () => {
    const before = buildReminders({ wall: at("2026-10-26", "13:40"), tasks, finals: [], leadMinutes: 15 });
    expect(before).toEqual([]);
    const inside = buildReminders({ wall: at("2026-10-26", "13:50"), tasks, finals: [], leadMinutes: 15 });
    expect(inside).toEqual([
      { key: "start|b|2026-10-26", kind: "timed", title: "Starts in 10 min", body: "Lab at 14:00" },
    ]);
    const after = buildReminders({ wall: at("2026-10-26", "14:01"), tasks, finals: [], leadMinutes: 15 });
    expect(after).toEqual([]);
  });
});

describe("planMessages", () => {
  const dated = (n: number): Reminder[] =>
    Array.from({ length: n }, (_, i) => ({
      key: `due1|${i}`,
      kind: "dated" as const,
      title: "Due tomorrow",
      body: `Task ${i}`,
    }));

  it("sends up to two dated reminders individually", () => {
    expect(planMessages(dated(2), "2026-10-26")).toHaveLength(2);
  });

  it("collapses more than two into one summary", () => {
    expect(planMessages(dated(5), "2026-10-26")).toEqual([
      {
        title: "5 upcoming deadlines",
        body: "Task 0, Task 1, Task 2, Task 3",
        tag: "summary|2026-10-26",
      },
    ]);
  });
});

describe("isAllowedEndpoint", () => {
  it("accepts known push services", () => {
    expect(isAllowedEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedEndpoint("https://web.push.apple.com/QK1")).toBe(true);
    expect(isAllowedEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
  });

  it("rejects other hosts, http and non-strings", () => {
    expect(isAllowedEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(isAllowedEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedEndpoint(42)).toBe(false);
  });
});
