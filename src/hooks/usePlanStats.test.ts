import { describe, expect, it } from "vitest";
import { componentEstimate, computePlanStats, effectiveGrade } from "./usePlanStats";
import { defaultPlanConfig } from "../services/plan";
import type { PlanConfig, PlanCourse, PlanPayment } from "../types/models";

const config = (patch: Partial<PlanConfig> = {}): PlanConfig => ({
  ...defaultPlanConfig(),
  totalCreditsRequired: 100,
  groups: [
    { id: "m", label: "Mandatory", requiredCredits: 60 },
    { id: "e", label: "Elective", requiredCredits: 40 },
  ],
  ...patch,
});

const course = (patch: Partial<PlanCourse> = {}): PlanCourse => ({
  id: crypto.randomUUID(),
  name: "Course",
  credits: 4,
  status: "COMPLETED",
  updatedAt: 0,
  ...patch,
});

const payment = (patch: Partial<PlanPayment> = {}): PlanPayment => ({
  id: crypto.randomUUID(),
  date: "2026-01-01",
  amount: 1000,
  kind: "TUITION",
  paid: true,
  ...patch,
});

describe("computePlanStats credits", () => {
  it("counts completed and exempt credits as earned", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ credits: 5 }),
        course({ credits: 3, status: "EXEMPT" }),
        course({ credits: 4, status: "IN_PROGRESS" }),
        course({ credits: 6, status: "PLANNED" }),
      ],
      []
    );
    expect(stats.creditsDone).toBe(8);
    expect(stats.creditsActive).toBe(4);
    expect(stats.creditsPlanned).toBe(6);
    expect(stats.creditsLeft).toBe(92);
    expect(stats.progressPct).toBeCloseTo(8);
  });

  it("earns nothing from a failed attempt but keeps the passing retake", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ name: "Probability", credits: 3.5, status: "FAILED", grade: 54 }),
        course({ name: "Probability", credits: 3.5, status: "COMPLETED", grade: 78 }),
      ],
      []
    );
    expect(stats.creditsDone).toBe(3.5);
    expect(stats.average).toBe(78);
  });

  it("ignores audited courses everywhere", () => {
    const stats = computePlanStats(
      config(),
      [course({ credits: 4, grade: 90, countsToward: false })],
      []
    );
    expect(stats.creditsDone).toBe(0);
    expect(stats.average).toBeNull();
  });

  it("survives a degree with no required credits", () => {
    const stats = computePlanStats(config({ totalCreditsRequired: 0 }), [course()], []);
    expect(stats.progressPct).toBe(0);
    expect(stats.creditsLeft).toBe(0);
  });
});

describe("computePlanStats average", () => {
  it("weights grades by credits", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ credits: 5, grade: 90 }),
        course({ credits: 1, grade: 60 }),
      ],
      []
    );
    expect(stats.average).toBeCloseTo(85);
  });

  it("keeps pass/fail credits but drops them from the average", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ credits: 4, grade: 80 }),
        course({ credits: 3, grade: 100, passFail: true }),
      ],
      []
    );
    expect(stats.creditsDone).toBe(7);
    expect(stats.average).toBe(80);
  });

  it("returns null when nothing is graded", () => {
    const stats = computePlanStats(config(), [course({ status: "PLANNED" })], []);
    expect(stats.average).toBeNull();
    expect(stats.projectedAverage).toBeNull();
  });

  it("folds graded parts of in-progress courses into the projection only", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ credits: 4, grade: 80 }),
        course({
          credits: 4,
          status: "IN_PROGRESS",
          components: [
            { id: "a", label: "Exam", weight: 50, grade: 100 },
            { id: "b", label: "Homework", weight: 50 },
          ],
        }),
      ],
      []
    );
    expect(stats.average).toBe(80);
    expect(stats.projectedAverage).toBeCloseTo(90);
  });
});

describe("componentEstimate", () => {
  it("uses only the parts that carry a grade", () => {
    const c = course({
      components: [
        { id: "a", label: "Exam", weight: 60, grade: 90 },
        { id: "b", label: "Homework", weight: 40 },
      ],
    });
    expect(componentEstimate(c)).toBe(90);
  });

  it("weights the graded parts against each other", () => {
    const c = course({
      components: [
        { id: "a", label: "Exam", weight: 75, grade: 80 },
        { id: "b", label: "Homework", weight: 25, grade: 100 },
      ],
    });
    expect(componentEstimate(c)).toBe(85);
  });

  it("prefers the explicit grade over the estimate", () => {
    const c = course({
      grade: 70,
      components: [{ id: "a", label: "Exam", weight: 100, grade: 95 }],
    });
    expect(effectiveGrade(c)).toBe(70);
  });

  it("returns null with no graded parts", () => {
    expect(componentEstimate(course({ components: [] }))).toBeNull();
  });
});

describe("computePlanStats groups", () => {
  it("splits credits per requirement group", () => {
    const stats = computePlanStats(
      config(),
      [
        course({ credits: 30, groupId: "m" }),
        course({ credits: 10, groupId: "e" }),
        course({ credits: 4 }),
      ],
      []
    );
    const [mandatory, elective] = stats.byGroup;
    expect(mandatory.done).toBe(30);
    expect(mandatory.pct).toBeCloseTo(50);
    expect(mandatory.level).toBe("mid");
    expect(elective.done).toBe(10);
    expect(elective.level).toBe("low");
  });
});

describe("computePlanStats money", () => {
  it("separates paid, billed and projected, and never counts a bill twice", () => {
    const cfg = config({
      totalCreditsRequired: 100,
      cost: {
        currency: "ILS",
        pricePerCredit: 100,
        perSemesterFee: 0,
        oneTimeFees: [],
        semestersRemainingOverride: 2,
      },
    });
    const stats = computePlanStats(
      cfg,
      [course({ credits: 50 })],
      [payment({ amount: 5000 }), payment({ amount: 1000, paid: false })]
    );
    expect(stats.money.spent).toBe(5000);
    expect(stats.money.due).toBe(1000);
    // 50 credits left x 100 = 5000, minus the 1000 already billed.
    expect(stats.money.projected).toBe(4000);
    expect(stats.money.total).toBe(10000);
    expect(stats.money.perCredit).toBe(100);
  });

  it("treats a scholarship as a negative amount", () => {
    const stats = computePlanStats(
      config(),
      [],
      [payment({ amount: 5000 }), payment({ amount: -2000, kind: "SCHOLARSHIP" })]
    );
    expect(stats.money.spent).toBe(3000);
  });
});

describe("computePlanStats timeline", () => {
  it("projects graduation from the current term and remaining credits", () => {
    const stats = computePlanStats(
      config({ totalCreditsRequired: 60 }),
      [
        course({ credits: 20, year: 2025, semester: "Semester A" }),
        course({ credits: 20, year: 2026, semester: "Semester A", status: "IN_PROGRESS" }),
      ],
      []
    );
    expect(stats.currentTerm).toEqual({ year: 2026, semester: "Semester A" });
    expect(stats.semestersRemaining).toBe(2);
    expect(stats.graduationTerm).toBe("Sem B 2026");
  });

  it("honors an explicit semesters-left override", () => {
    const stats = computePlanStats(
      config({
        totalCreditsRequired: 100,
        cost: { ...defaultPlanConfig().cost, semestersRemainingOverride: 4 },
      }),
      [course({ credits: 10, year: 2026, semester: "Semester B" })],
      []
    );
    expect(stats.semestersRemaining).toBe(4);
    expect(stats.graduationTerm).toBe("Sem A 2028");
  });
});
