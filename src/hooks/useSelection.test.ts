import { describe, expect, it, afterEach, vi } from "vitest";
import { pickSemesterForYear } from "./useSelection";
import type { YearTreeData } from "../types/models";

const makeYear = (year: number, sems: string[]): YearTreeData => ({
  year,
  semesters: sems.map((name) => ({
    name,
    key: name,
    courses: [],
  })),
});

describe("pickSemesterForYear", () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("returns null for an empty semester list", () => {
    expect(pickSemesterForYear("u1", makeYear(2026, []))).toBeNull();
  });

  it("prefers per-year saved selection when present and valid", () => {
    const uid = "u1";
    localStorage.setItem(
      `oplanner.lastSemesterByYear.${uid}`,
      JSON.stringify({ "2026": "Semester C" })
    );
    expect(
      pickSemesterForYear(uid, makeYear(2026, ["Semester A", "Semester B", "Semester C"]))
    ).toBe("Semester C");
  });

  it("ignores saved selection if that semester no longer exists", () => {
    const uid = "u1";
    localStorage.setItem(
      `oplanner.lastSemesterByYear.${uid}`,
      JSON.stringify({ "2026": "Semester C" })
    );
    vi.useFakeTimers();
    // Force month to be October (month index 9) → heuristic picks Semester A
    vi.setSystemTime(new Date(2026, 9, 15));
    const got = pickSemesterForYear(uid, makeYear(2026, ["Semester A", "Semester B"]));
    expect(got).toBe("Semester A");
  });

  it("heuristic: Oct-Jan → Semester A", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1)); // November
    expect(
      pickSemesterForYear(null, makeYear(2026, ["Semester A", "Semester B", "Semester C"]))
    ).toBe("Semester A");
  });

  it("heuristic: Feb-Jul → Semester B", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 1)); // April
    expect(
      pickSemesterForYear(null, makeYear(2026, ["Semester A", "Semester B", "Semester C"]))
    ).toBe("Semester B");
  });

  it("heuristic: Aug-Sep → Semester C", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 1)); // August
    expect(
      pickSemesterForYear(null, makeYear(2026, ["Semester A", "Semester B", "Semester C"]))
    ).toBe("Semester C");
  });

  it("falls back to Semester A if heuristic semester missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 1)); // April → wants Semester B
    expect(
      pickSemesterForYear(null, makeYear(2026, ["Semester A", "Semester C"]))
    ).toBe("Semester A");
  });

  it("falls back to first semester if no A/heuristic", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 1));
    expect(pickSemesterForYear(null, makeYear(2026, ["Custom", "Other"]))).toBe("Custom");
  });

  it("does not throw on corrupt localStorage map", () => {
    const uid = "u1";
    localStorage.setItem(`oplanner.lastSemesterByYear.${uid}`, "{not json");
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1));
    expect(
      pickSemesterForYear(uid, makeYear(2026, ["Semester A"]))
    ).toBe("Semester A");
  });
});
