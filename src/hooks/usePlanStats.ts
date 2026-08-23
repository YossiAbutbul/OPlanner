import { useMemo } from "react";
import type {
  PlanConfig,
  PlanCourse,
  PlanCourseStatus,
  PlanPayment,
  RequirementGroup,
} from "../types/models";

// Everything the Study Plan screen shows is derived here. Pure functions, no
// Firestore, no React state — so the rules stay testable. See
// docs/study-plan.md section 4 for the formulas.

export interface GroupProgress {
  group: RequirementGroup;
  done: number;
  active: number;
  required: number;
  pct: number;
  level: "low" | "mid" | "high";
}

export interface YearAverage {
  year: number;
  average: number;
  credits: number;
}

export interface MoneyStats {
  spent: number;
  due: number;
  projected: number;
  total: number;
  perCredit: number;
  /** Courses already registered, so already billed. */
  coursesBilled: number;
  /** Courses still to take, from what is planned or from the credits left. */
  coursesRemaining: number;
  /** Courses still inside the paid-courses cap. null when there is no cap. */
  coursesLeftToPay: number | null;
  /** Courses that fall past the cap and therefore cost nothing. */
  coursesFree: number;
}

export interface PlanStats {
  creditsDone: number;
  creditsActive: number;
  creditsPlanned: number;
  creditsLeft: number;
  creditsRequired: number;
  progressPct: number;
  activePct: number;
  average: number | null;
  projectedAverage: number | null;
  byGroup: GroupProgress[];
  byYear: YearAverage[];
  money: MoneyStats;
  semestersRemaining: number;
  graduationTerm: string | null;
  creditsPerSemesterNeeded: number;
  statusCounts: Record<PlanCourseStatus, number>;
  currentTerm: { year: number; semester: string } | null;
}

const DEFAULT_CREDITS_PER_SEMESTER = 15;
const DEFAULT_CREDITS_PER_COURSE = 4;
const SEMESTER_ORDER = ["Semester A", "Semester B", "Semester C"];

export const level = (pct: number): "low" | "mid" | "high" =>
  pct >= 67 ? "high" : pct >= 34 ? "mid" : "low";

const counts = (c: PlanCourse) => c.countsToward !== false;

// Credits are earned by courses that finished successfully. A failed
// attempt keeps its row for history but earns nothing.
const EARNING: PlanCourseStatus[] = ["COMPLETED", "EXEMPT"];

// Statuses that mean the course was registered, so tuition was charged for
// it. Exempt courses are free; planned ones have not been billed yet.
const BILLED: PlanCourseStatus[] = ["COMPLETED", "IN_PROGRESS", "FAILED", "DROPPED"];

// Weighted grade of a course from its parts, using only the parts that
// already have a grade. Returns null while nothing is graded.
export const componentEstimate = (course: PlanCourse): number | null => {
  const parts = (course.components ?? []).filter(
    (p) => typeof p.grade === "number" && p.weight > 0
  );
  if (parts.length === 0) return null;
  const weight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (weight <= 0) return null;
  const total = parts.reduce((sum, p) => sum + p.weight * (p.grade as number), 0);
  return total / weight;
};

// The grade to show for a course: the explicit one, else what its parts say.
export const effectiveGrade = (course: PlanCourse): number | null =>
  typeof course.grade === "number" ? course.grade : componentEstimate(course);

const weightedAverage = (entries: { grade: number; credits: number }[]): number | null => {
  const usable = entries.filter((e) => e.credits > 0);
  if (usable.length === 0) return null;
  const credits = usable.reduce((s, e) => s + e.credits, 0);
  if (credits <= 0) return null;
  return usable.reduce((s, e) => s + e.grade * e.credits, 0) / credits;
};

const termKey = (year: number, semester: string) =>
  year * 10 + Math.max(0, SEMESTER_ORDER.indexOf(semester));

// A → B → next year A. Semester C is a summer term and is skipped unless a
// course already sits in one.
const advanceTerm = (
  term: { year: number; semester: string },
  steps: number
): { year: number; semester: string } => {
  let { year } = term;
  let index = Math.max(0, SEMESTER_ORDER.indexOf(term.semester));
  for (let i = 0; i < steps; i++) {
    index += 1;
    if (index > 1) {
      index = 0;
      year += 1;
    }
  }
  return { year, semester: SEMESTER_ORDER[index] };
};

export const formatTerm = (term: { year: number; semester: string } | null): string | null =>
  term ? `${term.semester.replace("Semester ", "Sem ")} ${term.year}` : null;

export const computePlanStats = (
  config: PlanConfig,
  courses: PlanCourse[],
  payments: PlanPayment[]
): PlanStats => {
  const counted = courses.filter(counts);

  const sumCredits = (list: PlanCourse[]) => list.reduce((s, c) => s + (c.credits || 0), 0);

  const creditsDone = sumCredits(counted.filter((c) => EARNING.includes(c.status)));
  const creditsActive = sumCredits(counted.filter((c) => c.status === "IN_PROGRESS"));
  const creditsPlanned = sumCredits(counted.filter((c) => c.status === "PLANNED"));
  const creditsRequired = Math.max(0, config.totalCreditsRequired);
  const creditsLeft = Math.max(0, creditsRequired - creditsDone);
  const progressPct = creditsRequired > 0 ? (creditsDone / creditsRequired) * 100 : 0;
  const activePct = creditsRequired > 0 ? (creditsActive / creditsRequired) * 100 : 0;

  // Average: finished, graded, credit-bearing, not pass/fail.
  const gradedDone = counted
    .filter((c) => c.status === "COMPLETED" && !c.passFail)
    .map((c) => ({ grade: effectiveGrade(c), credits: c.credits || 0 }))
    .filter((e): e is { grade: number; credits: number } => e.grade !== null);
  const average = weightedAverage(gradedDone);

  const gradedActive = counted
    .filter((c) => c.status === "IN_PROGRESS" && !c.passFail)
    .map((c) => ({ grade: componentEstimate(c), credits: c.credits || 0 }))
    .filter((e): e is { grade: number; credits: number } => e.grade !== null);
  const projectedAverage = weightedAverage([...gradedDone, ...gradedActive]);

  // Per requirement group.
  const byGroup: GroupProgress[] = config.groups.map((group) => {
    const inGroup = counted.filter((c) => c.groupId === group.id);
    const done = sumCredits(inGroup.filter((c) => EARNING.includes(c.status)));
    const active = sumCredits(inGroup.filter((c) => c.status === "IN_PROGRESS"));
    const pct = group.requiredCredits > 0 ? (done / group.requiredCredits) * 100 : 0;
    return {
      group,
      done,
      active,
      required: group.requiredCredits,
      pct: Math.min(100, pct),
      level: level(pct),
    };
  });

  // Per academic year.
  const yearBuckets = new Map<number, { grade: number; credits: number }[]>();
  counted
    .filter((c) => c.status === "COMPLETED" && !c.passFail && typeof c.year === "number")
    .forEach((c) => {
      const grade = effectiveGrade(c);
      if (grade === null) return;
      const list = yearBuckets.get(c.year as number) ?? [];
      list.push({ grade, credits: c.credits || 0 });
      yearBuckets.set(c.year as number, list);
    });
  const byYear: YearAverage[] = [...yearBuckets.entries()]
    .map(([year, entries]) => ({
      year,
      average: weightedAverage(entries) ?? 0,
      credits: entries.reduce((s, e) => s + e.credits, 0),
    }))
    .filter((y) => y.average > 0)
    .sort((a, b) => a.year - b.year);

  // Where the student is right now: latest term that has a course in it.
  const termed = courses.filter(
    (c) => typeof c.year === "number" && typeof c.semester === "string"
  );
  const activeTerms = termed.filter((c) => c.status === "IN_PROGRESS");
  const pool = activeTerms.length ? activeTerms : termed;
  const currentTerm =
    pool.length > 0
      ? pool
          .map((c) => ({ year: c.year as number, semester: c.semester as string }))
          .reduce((a, b) => (termKey(b.year, b.semester) > termKey(a.year, a.semester) ? b : a))
      : null;

  // Pace: credits per term the student has actually carried so far.
  const termLoads = new Map<number, number>();
  termed
    .filter((c) => EARNING.includes(c.status) || c.status === "IN_PROGRESS")
    .forEach((c) => {
      const key = termKey(c.year as number, c.semester as string);
      termLoads.set(key, (termLoads.get(key) ?? 0) + (c.credits || 0));
    });
  const pace =
    termLoads.size > 0
      ? [...termLoads.values()].reduce((s, v) => s + v, 0) / termLoads.size
      : DEFAULT_CREDITS_PER_SEMESTER;

  const semestersRemaining =
    config.cost.semestersRemainingOverride ??
    (creditsLeft > 0 ? Math.max(1, Math.ceil(creditsLeft / Math.max(1, pace))) : 0);

  const graduationTerm =
    semestersRemaining > 0 && currentTerm
      ? formatTerm(advanceTerm(currentTerm, semestersRemaining - 1))
      : semestersRemaining === 0
        ? formatTerm(currentTerm)
        : null;

  const creditsPerSemesterNeeded =
    semestersRemaining > 0 ? creditsLeft / semestersRemaining : 0;

  // Money. Paid rows are history, unpaid rows are a bill already issued, and
  // the projection covers what has not been billed yet. The billed amount is
  // netted out of the projection so the same tuition isn't counted twice.
  const spent = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const due = payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);
  const unpaidFees = config.cost.oneTimeFees
    .filter((f) => !f.paid)
    .reduce((s, f) => s + f.amount, 0);

  // Courses that have been registered are already billed; exempt ones never
  // cost anything, planned ones have not been billed yet.
  const coursesBilled = counted.filter((c) => BILLED.includes(c.status)).length;
  const plannedCourses = counted.filter((c) => c.status === "PLANNED").length;
  const withCredits = counted.filter((c) => (c.credits || 0) > 0);
  const avgCreditsPerCourse =
    withCredits.length > 0
      ? withCredits.reduce((s, c) => s + c.credits, 0) / withCredits.length
      : DEFAULT_CREDITS_PER_COURSE;
  // In-progress credits are inside creditsLeft but are already billed.
  const creditsToBuy = Math.max(0, creditsLeft - creditsActive);
  const coursesRemaining = Math.max(
    plannedCourses,
    avgCreditsPerCourse > 0 ? Math.ceil(creditsToBuy / avgCreditsPerCourse) : 0
  );

  const cap = config.cost.paidCoursesCap && config.cost.paidCoursesCap > 0
    ? config.cost.paidCoursesCap
    : null;
  const coursesLeftToPay = cap === null ? null : Math.max(0, cap - coursesBilled);
  // Everything past the cap is free, both what is already taken and what is
  // still to come.
  const coursesFree =
    cap === null
      ? 0
      : Math.max(0, coursesBilled - cap) +
        Math.max(0, coursesRemaining - (coursesLeftToPay ?? 0));

  const perCourse = config.cost.pricePerCourse ?? 0;
  const billableRemaining =
    coursesLeftToPay === null ? coursesRemaining : Math.min(coursesRemaining, coursesLeftToPay);
  const tuitionAhead =
    config.cost.pricingMode === "PER_COURSE"
      ? billableRemaining * perCourse
      : creditsLeft * config.cost.pricePerCredit;

  const rawProjection =
    tuitionAhead + config.cost.perSemesterFee * semestersRemaining + unpaidFees;
  const projected = Math.max(0, rawProjection - Math.max(0, due));
  const money: MoneyStats = {
    spent,
    due,
    projected,
    total: spent + due + projected,
    perCredit: creditsDone > 0 ? spent / creditsDone : 0,
    coursesBilled,
    coursesRemaining,
    coursesLeftToPay,
    coursesFree,
  };

  const statusCounts = courses.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    {
      COMPLETED: 0,
      IN_PROGRESS: 0,
      PLANNED: 0,
      EXEMPT: 0,
      FAILED: 0,
      DROPPED: 0,
    } as Record<PlanCourseStatus, number>
  );

  return {
    creditsDone,
    creditsActive,
    creditsPlanned,
    creditsLeft,
    creditsRequired,
    progressPct: Math.min(100, progressPct),
    activePct: Math.min(100, activePct),
    average,
    projectedAverage,
    byGroup,
    byYear,
    money,
    semestersRemaining,
    graduationTerm,
    creditsPerSemesterNeeded,
    statusCounts,
    currentTerm,
  };
};

export const usePlanStats = (
  config: PlanConfig,
  courses: PlanCourse[],
  payments: PlanPayment[]
): PlanStats =>
  useMemo(() => computePlanStats(config, courses, payments), [config, courses, payments]);
