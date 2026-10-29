import { describe, expect, it } from "vitest";
import {
  assignmentKey,
  isAssignmentName,
  mergeMissingFinal,
  mergeNewAssignments,
  reconcileWithImport,
  sheetFromTasks,
} from "./gradeSheet";
import type { GradeItem } from "../types/models";

// Imported unless a test says otherwise: that is where sheets come from.
const task = (name: string, dueDate: string, extra: { isFinal?: boolean; isImported?: boolean } = {}) => ({
  name,
  dueDate,
  isFinal: extra.isFinal ?? false,
  isImported: extra.isImported ?? true,
});

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};

describe("isAssignmentName", () => {
  it("catches the ways an Open University assignment is written", () => {
    for (const name of [
      'מטלה 11 (ממ"ן)',
      "מטלה 12 (ממ״ח)",
      "ממן 11",
      "ממח 3",
      'ממ"ן 14',
      "מטלה מקוונת",
      "מטלה",
      "אופל 2",
      "Maman 11",
      "mamach 2",
      "Assignment 01",
    ]) {
      expect(isAssignmentName(name), name).toBe(true);
    }
  });

  it("leaves everything else alone", () => {
    for (const name of [
      "מפגש",
      "מפגש בהנחיה מקוונת",
      "בחינת גמר",
      "מבחן סופי",
      "התחלת סמסטר",
      "Lecture 4",
      // A todo about an assignment is not the assignment.
      "לסיים ממן 11",
      "להגיש מטלה 04",
      'מועד אחרון להגשת ממ"ן',
    ]) {
      expect(isAssignmentName(name), name).toBe(false);
    }
  });
});

describe("sheetFromTasks", () => {
  it("returns null when the course has no assignments and no final", () => {
    expect(sheetFromTasks([task("מפגש", "2026-10-01"), task("Lecture", "2026-10-08")])).toBeNull();
  });

  it("starts a sheet from the final alone, worth the whole grade", () => {
    const sheet = sheetFromTasks([
      task("מפגש", "2026-10-01"),
      task("Final Exam – Java", "2027-01-28", { isFinal: true, isImported: false }),
    ]);
    expect(sheet).toEqual([{ label: "Final Exam – Java", weight: 100 }]);
  });

  it("ignores tasks the student wrote themselves", () => {
    expect(
      sheetFromTasks([
        task("לסיים ממן 11", "2026-11-01", { isImported: false }),
        task("ממן 11", "2026-11-01", { isImported: false }),
      ])
    ).toBeNull();
  });

  it("orders assignments by due date and gives the final 70%", () => {
    const sheet = sheetFromTasks([
      task("מטלה 12", "2026-12-01"),
      task("בחינת גמר", "2027-01-28", { isFinal: true }),
      task("מטלה 11", "2026-11-01"),
      task("מטלה 13", "2027-01-01"),
    ]);
    expect(sheet).toEqual([
      { label: "מטלה 11", weight: 10 },
      { label: "מטלה 12", weight: 10 },
      { label: "מטלה 13", weight: 10 },
      { label: "בחינת גמר", weight: 70 },
    ]);
  });

  it("gives the assignments the whole grade when there is no final", () => {
    const sheet = sheetFromTasks([task("ממן 1", "2026-11-01"), task("ממן 2", "2026-12-01")]);
    expect(sheet).toEqual([
      { label: "ממן 1", weight: 50 },
      { label: "ממן 2", weight: 50 },
    ]);
  });

  it("adds up to exactly 100 when the split does not divide evenly", () => {
    const tasks = Array.from({ length: 7 }, (_, i) => task(`מטלה ${i + 1}`, `2026-11-0${i + 1}`));
    const sheet = sheetFromTasks([...tasks, task("מבחן", "2027-01-28", { isFinal: true })])!;
    expect(sheet.reduce((n, i) => n + i.weight, 0)).toBeCloseTo(100);
  });

  it("keeps one row per assignment when a name repeats", () => {
    const sheet = sheetFromTasks([task("מטלה 11", "2026-11-01"), task("מטלה 11", "2026-11-02")]);
    expect(sheet).toHaveLength(1);
  });
});

describe("assignmentKey", () => {
  it("reads 01 and 1 as the same assignment", () => {
    expect(assignmentKey("Assignment 01")).toBe(assignmentKey('מטלה 1 (ממ"ן)'));
    expect(assignmentKey("ממן 11")).toBe(assignmentKey("Assignment 11"));
  });

  it("separates different numbers", () => {
    expect(assignmentKey("מטלה 11")).not.toBe(assignmentKey("מטלה 12"));
  });

  it("falls back to the name when there is no number", () => {
    expect(assignmentKey("  Final   Exam ")).toBe("final exam");
  });
});

describe("mergeNewAssignments", () => {
  const sheet: GradeItem[] = [
    { id: "a", label: "Assignment 01", weight: 10, score: 92 },
    { id: "b", label: "Final exam", weight: 70 },
  ];

  it("adds an assignment the sheet does not have yet, at zero weight", () => {
    const merged = mergeNewAssignments(sheet, [task('מטלה 2 (ממ"ן)', "2026-12-01")], ids());
    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({ label: 'מטלה 2 (ממ"ן)', weight: 0 });
  });

  it("leaves the sheet untouched when the assignment is already on it", () => {
    const merged = mergeNewAssignments(sheet, [task('מטלה 1 (ממ"ן)', "2026-11-01")], ids());
    expect(merged).toBe(sheet);
  });

  it("does not touch the weight or score of a row it already knows", () => {
    const merged = mergeNewAssignments(
      sheet,
      [task("ממן 1", "2026-11-01"), task("ממן 3", "2027-01-01")],
      ids()
    );
    expect(merged[0]).toEqual(sheet[0]);
    expect(merged).toHaveLength(3);
  });
});

describe("reconcileWithImport", () => {
  const imported = [
    task('מטלה 01 (ממ"ן)', "2026-11-13"),
    task('מטלה 02 (ממ"ן)', "2026-11-27"),
    task("בחינת גמר", "2027-01-28", { isFinal: true }),
  ];

  it("replaces an untouched placeholder sheet with the calendar's own names", () => {
    const generic: GradeItem[] = [
      { id: "1", label: "Assignment 01", weight: 10 },
      { id: "2", label: "Assignment 02", weight: 10 },
      { id: "3", label: "Assignment 03", weight: 10 },
      { id: "4", label: "Final exam", weight: 70 },
    ];
    const out = reconcileWithImport(generic, imported, ids())!;
    expect(out.map((i) => i.label)).toEqual(['מטלה 01 (ממ"ן)', 'מטלה 02 (ממ"ן)', "בחינת גמר"]);
    expect(out.map((i) => i.weight)).toEqual([15, 15, 70]);
  });

  it("drops the empty rows an earlier version added for the student's todos", () => {
    const messy: GradeItem[] = [
      { id: "1", label: "Assignment 01", weight: 10 },
      { id: "2", label: "לסיים ממן 11", weight: 0 },
    ];
    const out = reconcileWithImport(messy, imported, ids())!;
    expect(out.some((i) => i.label === "לסיים ממן 11")).toBe(false);
    expect(out.some((i) => i.label === "Assignment 01")).toBe(false);
  });

  it("keeps every row the student has filled in, and adds what is missing", () => {
    const mine: GradeItem[] = [
      { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 20, score: 95 },
      { id: "2", label: "Lab work", weight: 10 },
    ];
    const out = reconcileWithImport(mine, imported, ids())!;
    expect(out.slice(0, 2)).toEqual(mine);
    expect(out.map((i) => i.label)).toContain('מטלה 02 (ממ"ן)');
    // The new row arrives blank so the grade cannot move on its own.
    expect(out.find((i) => i.label === 'מטלה 02 (ממ"ן)')?.weight).toBe(0);
  });

  it("keeps a graded placeholder, since the mark is the student's", () => {
    const graded: GradeItem[] = [{ id: "1", label: "Assignment 01", weight: 10, score: 88 }];
    const out = reconcileWithImport(graded, imported, ids())!;
    expect(out[0]).toEqual(graded[0]);
  });

  it("leaves a sheet alone when the course has nothing imported", () => {
    const mine: GradeItem[] = [{ id: "1", label: "Lab work", weight: 100 }];
    expect(reconcileWithImport(mine, [task("מפגש", "2026-10-01")], ids())).toBeNull();
    expect(reconcileWithImport([], [], ids())).toBeNull();
  });
});

describe("mergeMissingFinal", () => {
  const final = task("Final Exam – Java", "2027-01-28", { isFinal: true, isImported: false });

  it("adds the final with the weight nothing else claims", () => {
    const sheet: GradeItem[] = [
      { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 10 },
      { id: "2", label: 'מטלה 02 (ממ"ן)', weight: 20 },
    ];
    const out = mergeMissingFinal(sheet, [final], ids());
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ label: "Final Exam – Java", weight: 70 });
  });

  it("adds it at zero when the sheet is already full", () => {
    const sheet: GradeItem[] = [{ id: "1", label: "Project", weight: 100 }];
    expect(mergeMissingFinal(sheet, [final], ids())[1].weight).toBe(0);
  });

  it("does not add a second final when the sheet already has one", () => {
    for (const label of ["Final exam", "בחינת גמר", "מבחן סופי", "Final Exam – Java"]) {
      const sheet: GradeItem[] = [{ id: "1", label, weight: 70 }];
      expect(mergeMissingFinal(sheet, [final], ids()), label).toBe(sheet);
    }
  });

  it("does nothing until a final date is set", () => {
    const sheet: GradeItem[] = [{ id: "1", label: "Project", weight: 50 }];
    expect(mergeMissingFinal(sheet, [task('מטלה 01 (ממ"ן)', "2026-11-13")], ids())).toBe(sheet);
  });
});

describe("dismissed assignments", () => {
  const imported = [
    task('מטלה 01 (ממ"ן)', "2026-11-13"),
    task("מטלת השתתפות", "2026-12-01"),
    task("Final Exam – Java", "2027-01-28", { isFinal: true, isImported: false }),
  ];
  const skip = new Set([assignmentKey("מטלת השתתפות")]);

  it("leaves a dismissed assignment off a sheet built from scratch", () => {
    const sheet = sheetFromTasks(imported, skip)!;
    expect(sheet.map((i) => i.label)).toEqual(['מטלה 01 (ממ"ן)', "Final Exam – Java"]);
  });

  it("does not add it back on the next merge", () => {
    const sheet: GradeItem[] = [{ id: "1", label: 'מטלה 01 (ממ"ן)', weight: 30 }];
    const out = mergeNewAssignments(sheet, imported, ids(), skip);
    expect(out).toBe(sheet);
  });

  it("does not add a dismissed final back either", () => {
    const sheet: GradeItem[] = [{ id: "1", label: 'מטלה 01 (ממ"ן)', weight: 100 }];
    const finalSkip = new Set([assignmentKey("Final Exam – Java")]);
    expect(mergeMissingFinal(sheet, imported, ids(), finalSkip)).toBe(sheet);
  });

  it("keeps the rest of the import coming", () => {
    const sheet: GradeItem[] = [{ id: "1", label: "Lab work", weight: 40 }];
    const out = reconcileWithImport(sheet, imported, ids(), skip)!;
    expect(out.map((i) => i.label)).toEqual(["Lab work", 'מטלה 01 (ממ"ן)', "Final Exam – Java"]);
  });
});
