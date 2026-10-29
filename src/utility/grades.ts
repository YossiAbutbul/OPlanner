import type { GradeItem } from "../types/models";

// What the grade sheet adds up to. Every figure is on the course's own
// 0–100 scale; weights are percentages of the final grade.
export interface GradeSummary {
  // Weight of the items that already have a score.
  gradedWeight: number;
  // Weight of every item on the sheet, graded or not. 100 on a complete
  // sheet; less while the student is still filling it in, more if they
  // mistyped, which the panel warns about rather than silently fixing.
  totalWeight: number;
  // Points banked so far, out of totalWeight.
  earned: number;
  // The average over what has been graded, or null before anything has.
  soFar: number | null;
  // The course grade once every item is scored, else null.
  final: number | null;
  // Weight still to come.
  remainingWeight: number;
}

const hasScore = (i: GradeItem): i is GradeItem & { score: number } =>
  typeof i.score === "number";

export const summarize = (items: GradeItem[]): GradeSummary => {
  let totalWeight = 0;
  let gradedWeight = 0;
  let earned = 0;

  for (const item of items) {
    totalWeight += item.weight;
    if (!hasScore(item)) continue;
    gradedWeight += item.weight;
    earned += (item.score * item.weight) / 100;
  }

  const remainingWeight = Math.max(0, totalWeight - gradedWeight);
  return {
    gradedWeight,
    totalWeight,
    earned,
    soFar: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    final: totalWeight > 0 && remainingWeight === 0 ? earned : null,
    remainingWeight,
  };
};

// One course's contribution to the GPA.
export interface GpaEntry {
  grade: number;
  credits: number;
}

// Credit-weighted mean. A course with no credits set counts once, so a
// student who never fills credits in still gets a plain average.
export const semesterGpa = (entries: GpaEntry[]): number | null => {
  let weight = 0;
  let total = 0;
  for (const e of entries) {
    const credits = e.credits > 0 ? e.credits : 1;
    weight += credits;
    total += e.grade * credits;
  }
  return weight > 0 ? total / weight : null;
};

// Grades read better with one decimal, and without a trailing ".0".
export const formatGrade = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};
