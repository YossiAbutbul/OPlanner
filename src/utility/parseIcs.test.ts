import { describe, expect, it } from "vitest";
import { buildTaskName, parseIcs } from "./parseIcs";

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", body, "END:VCALENDAR"].join("\r\n");

const vevent = (lines: string[]) =>
  ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("parseIcs", () => {
  it("returns [] for empty / non-VEVENT input", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs(wrap(""))).toEqual([]);
  });

  it("extracts summary / description / location / dtstart", () => {
    const ics = wrap(
      vevent([
        "SUMMARY:Final exam",
        "DESCRIPTION:Algorithms",
        "LOCATION:Hall 1",
        "DTSTART:20260715T093000",
      ])
    );
    const [e] = parseIcs(ics);
    expect(e.summary).toBe("Final exam");
    expect(e.description).toBe("Algorithms");
    expect(e.location).toBe("Hall 1");
    expect(e.startDate).toBe("2026-07-15");
    expect(e.startTime).toBe("09:30");
  });

  it("treats VALUE=DATE as all-day (no startTime)", () => {
    const ics = wrap(
      vevent([
        "SUMMARY:All day",
        "DTSTART;VALUE=DATE:20260715",
      ])
    );
    const [e] = parseIcs(ics);
    expect(e.startDate).toBe("2026-07-15");
    expect(e.startTime).toBeNull();
  });

  it("skips events with no DTSTART", () => {
    const ics = wrap(vevent(["SUMMARY:Orphan"]));
    expect(parseIcs(ics)).toEqual([]);
  });

  it("unfolds RFC 5545 line continuations", () => {
    // Lines beginning with a space are continuations of the previous line.
    const folded = wrap(
      [
        "BEGIN:VEVENT",
        "SUMMARY:Long\r\n title continuation",
        "DTSTART:20260101T080000",
        "END:VEVENT",
      ].join("\r\n")
    );
    const [e] = parseIcs(folded);
    expect(e.summary).toBe("Longtitle continuation");
  });

  it("categorizes meeting / maman / mamach / other from summary", () => {
    const cases = [
      { sum: "מפגש 1", cat: "meeting" },
      { sum: 'ממ"ן 03', cat: "maman" },
      { sum: 'ממ״ן 03', cat: "maman" },
      { sum: 'ממ"ח 02', cat: "mamach" },
      { sum: "Other event", cat: "other" },
    ];
    for (const { sum, cat } of cases) {
      const ics = wrap(vevent([`SUMMARY:${sum}`, "DTSTART:20260101T080000"]));
      expect(parseIcs(ics)[0].category).toBe(cat);
    }
  });

  it("extracts course/courseNumber/semester/year from description", () => {
    const ics = wrap(
      vevent([
        "SUMMARY:Anything",
        "DESCRIPTION:קורס שפות תכנות (20905) בסמסטר ב2026",
        "DTSTART:20260101T080000",
      ])
    );
    const [e] = parseIcs(ics);
    expect(e.course).toBe("שפות תכנות");
    expect(e.courseNumber).toBe("20905");
    expect(e.semester).toBe("Semester B");
    expect(e.year).toBe(2026);
  });

  it("extracts task number from description", () => {
    const ics = wrap(
      vevent([
        "SUMMARY:Anything",
        "DESCRIPTION:מטלה 07 something",
        "DTSTART:20260101T080000",
      ])
    );
    const [e] = parseIcs(ics);
    expect(e.taskNumber).toBe("07");
  });

  it("nulls course fields when description doesn't match", () => {
    const ics = wrap(
      vevent([
        "SUMMARY:Anything",
        "DESCRIPTION:random text",
        "DTSTART:20260101T080000",
      ])
    );
    const [e] = parseIcs(ics);
    expect(e.course).toBeNull();
    expect(e.courseNumber).toBeNull();
    expect(e.semester).toBeNull();
    expect(e.year).toBeNull();
    expect(e.taskNumber).toBeNull();
  });
});

describe("buildTaskName", () => {
  const base = {
    summary: "raw",
    description: "",
    location: "",
    startDate: "2026-01-01",
    startTime: null,
    course: null,
    courseNumber: null,
    semester: null,
    year: null,
    taskNumber: null,
  };

  it("formats maman with task number", () => {
    expect(buildTaskName({ ...base, category: "maman", taskNumber: "5" } as const))
      .toBe('מטלה 5 (ממ"ן)');
  });

  it("formats maman with ? when task number missing", () => {
    expect(buildTaskName({ ...base, category: "maman" } as const))
      .toBe('מטלה ? (ממ"ן)');
  });

  it("formats mamach with task number", () => {
    expect(buildTaskName({ ...base, category: "mamach", taskNumber: "2" } as const))
      .toBe('מטלה 2 (ממ"ח)');
  });

  it("meeting includes start time when present", () => {
    expect(buildTaskName({ ...base, category: "meeting", startTime: "10:00" } as const))
      .toBe("מפגש 10:00");
    expect(buildTaskName({ ...base, category: "meeting" } as const))
      .toBe("מפגש");
  });

  it("other falls back to summary", () => {
    expect(buildTaskName({ ...base, category: "other", summary: "X" } as const))
      .toBe("X");
    expect(buildTaskName({ ...base, category: "other", summary: "" } as const))
      .toBe("Event");
  });
});
