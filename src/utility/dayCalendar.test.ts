import { describe, expect, it } from "vitest";
import {
  capitalizeWords,
  daysLeft,
  fmtDate,
  hexToRgba,
  isAllDay,
  minutesFromStart,
  minutesToHHmm,
  snapMin,
  toIso,
  urgencyClass,
} from "./dayCalendar";

describe("dayCalendar pure helpers", () => {
  it("toIso pads month and day", () => {
    expect(toIso(new Date(2026, 4, 5))).toBe("2026-05-05");
    expect(toIso(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("fmtDate flips to DD/MM/YY", () => {
    expect(fmtDate("2026-05-09")).toBe("09/05/26");
  });

  it("capitalizeWords title-cases each word", () => {
    expect(capitalizeWords("hello world")).toBe("Hello World");
    expect(capitalizeWords("data-structures")).toBe("Data-Structures");
  });

  it("daysLeft returns 0 for today, positive for future, negative for past", () => {
    const today = toIso(new Date());
    expect(daysLeft(today)).toBe(0);

    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(daysLeft(toIso(future))).toBe(5);

    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysLeft(toIso(past))).toBe(-3);
  });

  it("urgencyClass thresholds", () => {
    expect(urgencyClass(0)).toBe("danger");
    expect(urgencyClass(5)).toBe("danger");
    expect(urgencyClass(6)).toBe("warn");
    expect(urgencyClass(10)).toBe("warn");
    expect(urgencyClass(11)).toBe("ok");
    expect(urgencyClass(100)).toBe("ok");
  });

  it("minutesFromStart / minutesToHHmm round-trip", () => {
    expect(minutesFromStart("06:00")).toBe(0);
    expect(minutesFromStart("06:30")).toBe(30);
    expect(minutesFromStart("12:00")).toBe(360);

    expect(minutesToHHmm(0)).toBe("06:00");
    expect(minutesToHHmm(360)).toBe("12:00");

    // Clamps to grid range
    expect(minutesToHHmm(-100)).toBe("06:00");
    expect(minutesToHHmm(99999)).toBe("24:00");
  });

  it("snapMin snaps to 15-minute boundaries", () => {
    expect(snapMin(0)).toBe(0);
    expect(snapMin(7)).toBe(0);
    expect(snapMin(8)).toBe(15);
    expect(snapMin(22)).toBe(15);
    expect(snapMin(23)).toBe(30);
  });

  it("isAllDay covers explicit, legacy, and missing times", () => {
    expect(isAllDay("07:00", "23:00")).toBe(true);
    expect(isAllDay("00:00", "23:59")).toBe(true);
    expect(isAllDay(undefined, undefined)).toBe(true);
    expect(isAllDay("09:00", undefined)).toBe(true);
    expect(isAllDay("09:00", "10:00")).toBe(false);
  });

  it("hexToRgba parses 3- and 6-char hex", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(hexToRgba("ff0000", 1)).toBe("rgba(255, 0, 0, 1)");
    expect(hexToRgba("#f00", 0.25)).toBe("rgba(255, 0, 0, 0.25)");
  });
});
