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
  // The course grade once every item is scored and the weights add up to
  // 100, else null. A fully scored sheet that covers 80% is not a grade yet.
  final: number | null;
  // Weight still to come.
  remainingWeight: number;
  // The weights add up to 100, give or take float noise.
  balanced: boolean;
  // Most the course can still end on: full marks on everything not graded,
  // including whatever share of the 100 the sheet doesn't list yet.
  ceiling: number;
}

// 33.3 + 33.3 + 33.4 is not exactly 100 in floating point.
const WEIGHT_EPSILON = 0.05;

export const weightsBalanced = (total: number) => Math.abs(total - 100) < WEIGHT_EPSILON;

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
  const balanced = weightsBalanced(totalWeight);
  return {
    gradedWeight,
    totalWeight,
    earned,
    soFar: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    final: balanced && remainingWeight < WEIGHT_EPSILON ? earned : null,
    remainingWeight,
    balanced,
    ceiling: Math.min(100, earned + Math.max(0, 100 - gradedWeight)),
  };
};

/**
 * Hand the weight a sheet is missing to its rows that have none, evenly. Rows
 * the student already weighted are never touched. Null when there is nothing
 * to hand out or nowhere to put it, so the panel can hide the action.
 */
export const fillUnweighted = (items: GradeItem[]): GradeItem[] | null => {
  const total = items.reduce((n, i) => n + i.weight, 0);
  const missing = 100 - total;
  const empty = items.filter((i) => i.weight === 0);
  if (missing < WEIGHT_EPSILON || !empty.length) return null;
  const each = Math.round((missing / empty.length) * 10) / 10;
  const last = empty[empty.length - 1].id;
  const lastShare = Math.round((missing - each * (empty.length - 1)) * 10) / 10;
  return items.map((i) =>
    i.weight !== 0 ? i : { ...i, weight: i.id === last ? lastShare : each }
  );
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
