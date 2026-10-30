import { describe, expect, it } from "vitest";
import type { IcsEvent } from "./parseIcs";
import { academicHome, academicTask, importedStatus, lectureTask } from "./importTasks";

const ev = (over: Partial<IcsEvent>): IcsEvent => ({
  summary: "",
  description: "",
  location: "",
  startDate: "2026-10-25",
  startTime: null,
  endTime: null,
  category: "other",
  course: null,
  courseNumber: null,
  semester: null,
  year: null,
  taskNumber: null,
  ...over,
});

describe("lectureTask", () => {
  it("keeps the session's kind, hours and place", () => {
    const t = lectureTask(
      ev({
        summary: "מפגש בהנחיה מקוונת",
        category: "meeting",
        startTime: "18:00",
        endTime: "20:00",
        location: "Zoom",
        courseNumber: "20586",
      }),
      "סדנה בפיתוח אפליקציות לענן ולרשת"
    );
    expect(t).toMatchObject({ name: "מפגש בהנחיה מקוונת", startTime: "18:00", endTime: "20:00", notes: "Zoom" });
    expect(t.id).toMatch(/^imp_2026-10-25_1800_/);
  });

  it("gives a lecture with no end two hours", () => {
    expect(lectureTask(ev({ category: "meeting", startTime: "17:00" }), "X").endTime).toBe("19:00");
  });
});

describe("academicTask", () => {
  it("is all-day and named with its term", () => {
    expect(academicTask(ev({ summary: "התחלת הרשמה", description: 'אביב תשפ"ז (ב2027)' }))).toMatchObject({
      name: 'התחלת הרשמה · אביב תשפ"ז',
      startTime: "07:00",
      endTime: "23:00",
    });
  });
});

describe("academicHome", () => {
  const autumn = ev({ summary: "התחלת סמסטר", startDate: "2026-10-25", semester: "Semester A", year: 2027 });
  const spring = ev({ summary: "התחלת סמסטר", startDate: "2027-03-01", semester: "Semester B", year: 2027 });
  const all = [autumn, spring];

  it("files a date under the semester running when it happens", () => {
    const reg = ev({ summary: "התחלת הרשמה", startDate: "2026-11-01", semester: "Semester B", year: 2027 });
    expect(academicHome(reg, all)).toEqual({ year: 2027, semester: "Semester A" });
  });

  it("files a semester's own start under that semester", () => {
    expect(academicHome(spring, all)).toEqual({ year: 2027, semester: "Semester B" });
  });

  it("falls back to the term the event names", () => {
    const early = ev({ startDate: "2026-09-01", semester: "Semester A", year: 2027 });
    expect(academicHome(early, all)).toEqual({ year: 2027, semester: "Semester A" });
    expect(academicHome(ev({ startDate: "2026-09-01" }), all)).toBeNull();
  });
});

describe("importedStatus", () => {
  it("marks what already happened as done", () => {
    expect(importedStatus("2026-10-25", "2026-10-30")).toBe("COMPLETED");
    expect(importedStatus("2026-10-30", "2026-10-30")).toBe("PENDING");
  });
});
