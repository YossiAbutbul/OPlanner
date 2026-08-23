import { describe, expect, it } from "vitest";
import {
  applyRow,
  diffRows,
  guessField,
  guessMapping,
  parseGradeCell,
  parseNumberLoose,
  parseTermCell,
  rowFromCells,
  rowKey,
} from "./normalize";
import type { PlanCourse } from "../../types/models";

describe("guessField", () => {
  it("maps English headers", () => {
    expect(guessField("Course Code")).toBe("code");
    expect(guessField("Credits")).toBe("credits");
    expect(guessField("Grade")).toBe("grade");
    expect(guessField("Semester")).toBe("semester");
  });

  it("maps Hebrew headers", () => {
    expect(guessField('נק"ז')).toBe("credits");
    expect(guessField("ציון")).toBe("grade");
    expect(guessField("שם הקורס")).toBe("name");
    expect(guessField("מספר קורס")).toBe("code");
  });

  it("ignores what it does not recognize", () => {
    expect(guessField("Remarks column")).toBe("ignore");
    expect(guessField("")).toBe("ignore");
  });

  it("never assigns the same field to two columns", () => {
    const mapping = guessMapping(["Grade", "Grade", "Credits"]);
    expect(mapping).toEqual(["grade", "ignore", "credits"]);
  });
});

describe("cell parsing", () => {
  it("reads numbers with currency symbols and separators", () => {
    expect(parseNumberLoose("1,234")).toBe(1234);
    expect(parseNumberLoose("₪2,080")).toBe(2080);
    expect(parseNumberLoose("3.5")).toBe(3.5);
    expect(parseNumberLoose("")).toBeNull();
    expect(parseNumberLoose("-")).toBeNull();
  });

  it("reads grade words as statuses", () => {
    expect(parseGradeCell("88")).toEqual({ grade: 88 });
    expect(parseGradeCell("פטור")).toEqual({ status: "EXEMPT", passFail: true });
    expect(parseGradeCell("עובר")).toEqual({ status: "COMPLETED", passFail: true });
    expect(parseGradeCell("Failed")).toEqual({ status: "FAILED" });
    expect(parseGradeCell("")).toEqual({});
  });

  it("reads terms in both languages", () => {
    expect(parseTermCell("2026 א")).toEqual({ year: 2026, semester: "Semester A" });
    expect(parseTermCell("Semester B 2025")).toEqual({ year: 2025, semester: "Semester B" });
    expect(parseTermCell("סמסטר ג")).toEqual({ semester: "Semester C" });
    expect(parseTermCell("")).toEqual({});
  });
});

describe("rowFromCells", () => {
  const mapping = ["code", "name", "credits", "grade", "term"] as const;

  it("builds a course and infers the status from the grade", () => {
    const row = rowFromCells(
      ["62350", "Operating Systems", "4", "86", "2026 ב"],
      [...mapping],
      60
    );
    expect(row).toMatchObject({
      code: "62350",
      name: "Operating Systems",
      credits: 4,
      grade: 86,
      year: 2026,
      semester: "Semester B",
      status: "COMPLETED",
    });
  });

  it("marks a grade under the pass mark as failed", () => {
    const row = rowFromCells(["61230", "Probability", "3.5", "54", ""], [...mapping], 60);
    expect(row?.status).toBe("FAILED");
  });

  it("defaults to planned with no grade", () => {
    const row = rowFromCells(["62480", "Machine Learning", "3.5", "", ""], [...mapping], 60);
    expect(row?.status).toBe("PLANNED");
  });

  it("drops rows with neither name nor code", () => {
    expect(rowFromCells(["", "", "3", "80", ""], [...mapping], 60)).toBeNull();
  });

  it("rejects out-of-range credits instead of storing junk", () => {
    const row = rowFromCells(["1", "Weird", "900", "", ""], [...mapping], 60);
    expect(row?.credits).toBeUndefined();
  });
});

describe("dedupe and diff", () => {
  const existing: PlanCourse[] = [
    {
      id: "1",
      code: "62350",
      name: "Operating Systems",
      credits: 4,
      status: "IN_PROGRESS",
      updatedAt: 0,
    },
  ];

  it("keys on the course code when there is one", () => {
    expect(rowKey({ code: "62350", name: "Anything" })).toBe(rowKey({ code: "62350" }));
  });

  it("falls back to name plus term without a code", () => {
    expect(rowKey({ name: "Calculus 1", year: 2024, semester: "Semester A" })).not.toBe(
      rowKey({ name: "Calculus 1", year: 2025, semester: "Semester A" })
    );
  });

  it("marks a matching row as an update and lists the changes", () => {
    const [entry] = diffRows(
      [{ code: "62350", name: "Operating Systems", credits: 4, grade: 86, status: "COMPLETED" }],
      existing
    );
    expect(entry.kind).toBe("update");
    expect(entry.changes.map((c) => c.field)).toContain("grade");
    expect(entry.changes.map((c) => c.field)).toContain("status");
  });

  it("marks an unchanged row as same, so re-importing writes nothing", () => {
    const [entry] = diffRows(
      [{ code: "62350", name: "Operating Systems", credits: 4, status: "IN_PROGRESS" }],
      existing
    );
    expect(entry.kind).toBe("same");
  });

  it("marks an unknown course as new", () => {
    const [entry] = diffRows([{ code: "99999", name: "New Course", credits: 3 }], existing);
    expect(entry.kind).toBe("new");
  });
});

describe("applyRow", () => {
  it("merges onto an existing course without wiping blank fields", () => {
    const base: PlanCourse = {
      id: "1",
      code: "62350",
      name: "Operating Systems",
      credits: 4,
      status: "IN_PROGRESS",
      groupId: "m",
      updatedAt: 0,
    };
    const merged = applyRow({ code: "62350", grade: 86, status: "COMPLETED" }, base, "batch-1");
    expect(merged.id).toBe("1");
    expect(merged.groupId).toBe("m");
    expect(merged.credits).toBe(4);
    expect(merged.grade).toBe(86);
    expect(merged.status).toBe("COMPLETED");
    expect(merged.source).toBe("batch-1");
  });

  it("creates a fresh course when nothing matched", () => {
    const merged = applyRow({ name: "New Course", credits: 3 }, undefined, "batch-1");
    expect(merged.name).toBe("New Course");
    expect(merged.credits).toBe(3);
    expect(merged.status).toBe("PLANNED");
  });
});
