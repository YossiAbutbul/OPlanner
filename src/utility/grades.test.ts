import { describe, expect, it } from "vitest";
import { fillUnweighted, formatGrade, semesterGpa, summarize } from "./grades";
import type { GradeItem } from "../types/models";

const item = (label: string, weight: number, score?: number): GradeItem => {
  const i: GradeItem = { id: label, label, weight };
  if (score !== undefined) i.score = score;
  return i;
};

describe("summarize", () => {
  it("reports nothing graded on an empty sheet", () => {
    const s = summarize([]);
    expect(s).toEqual({
      gradedWeight: 0,
      totalWeight: 0,
      earned: 0,
      soFar: null,
      final: null,
      remainingWeight: 0,
      balanced: false,
      ceiling: 100,
    });
  });

  it("averages over the graded weight only", () => {
    // 90 on a tenth and 80 on a tenth: 17 points banked, average 85.
    const s = summarize([item("a", 10, 90), item("b", 10, 80), item("c", 80)]);
    expect(s.gradedWeight).toBe(20);
    expect(s.totalWeight).toBe(100);
    expect(s.earned).toBeCloseTo(17);
    expect(s.soFar).toBeCloseTo(85);
    expect(s.remainingWeight).toBe(80);
  });

  it("gives a final grade only once every item is scored", () => {
    expect(summarize([item("a", 50, 90), item("b", 50)]).final).toBeNull();
    expect(summarize([item("a", 50, 90), item("b", 50, 70)]).final).toBeCloseTo(80);
  });

  it("works on a sheet whose weights do not reach 100", () => {
    const s = summarize([item("a", 30, 60)]);
    expect(s.totalWeight).toBe(30);
    expect(s.soFar).toBeCloseTo(60);
    // Fully scored but only 30% of the course: not a final grade.
    expect(s.final).toBeNull();
    expect(s.balanced).toBe(false);
  });

  it("treats weights that round to 100 as complete", () => {
    const s = summarize([item("a", 33.3, 90), item("b", 33.3, 90), item("c", 33.4, 90)]);
    expect(s.balanced).toBe(true);
    expect(s.final).toBeCloseTo(90);
  });

  it("caps the ceiling at full marks on everything still open", () => {
    expect(summarize([item("a", 30, 50), item("b", 70)]).ceiling).toBeCloseTo(85);
    // An unlisted 40% is still open too.
    expect(summarize([item("a", 60, 50)]).ceiling).toBeCloseTo(70);
  });

  it("counts a zero score, unlike an ungraded item", () => {
    expect(summarize([item("a", 50, 0), item("b", 50, 100)]).soFar).toBeCloseTo(50);
    expect(summarize([item("a", 50), item("b", 50, 100)]).soFar).toBeCloseTo(100);
  });
});

describe("semesterGpa", () => {
  it("weights by credits", () => {
    expect(semesterGpa([{ grade: 100, credits: 3 }, { grade: 80, credits: 1 }])).toBeCloseTo(95);
  });

  it("treats a course with no credits as one", () => {
    expect(semesterGpa([{ grade: 90, credits: 0 }, { grade: 80, credits: 0 }])).toBeCloseTo(85);
  });

  it("returns null with nothing to average", () => {
    expect(semesterGpa([])).toBeNull();
  });
});

describe("formatGrade", () => {
  it("keeps one decimal and drops a trailing zero", () => {
    expect(formatGrade(86.44)).toBe("86.4");
    expect(formatGrade(90)).toBe("90");
    expect(formatGrade(89.96)).toBe("90");
  });
});

describe("fillUnweighted", () => {
  it("spreads the missing weight over the rows that have none", () => {
    const next = fillUnweighted([item("a", 70), item("b", 0), item("c", 0), item("d", 0)]);
    expect(next?.map((i) => i.weight)).toEqual([70, 10, 10, 10]);
  });

  it("lets the last row absorb the rounding", () => {
    const next = fillUnweighted([item("a", 0), item("b", 0), item("c", 0)]);
    expect(next?.map((i) => i.weight)).toEqual([33.3, 33.3, 33.4]);
  });

  it("returns null when there is nothing to fill or nowhere to put it", () => {
    expect(fillUnweighted([item("a", 100), item("b", 0)])).toBeNull();
    expect(fillUnweighted([item("a", 50), item("b", 30)])).toBeNull();
  });
});
