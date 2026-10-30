import { describe, expect, it } from "vitest";
import {
  assignmentKey,
  isAssignmentName,
  mergeMissingFinal,
  mergeNewAssignments,
  reconcileWithImport,
  applyWeights,
  orderSheet,
  FINAL_SKIP,
  withAutoExam,
  countedRows,
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
  it("starts every course with an exam row, even before a final date", () => {
    expect(sheetFromTasks([task("מפגש", "2026-10-01"), task("Lecture", "2026-10-08")])).toEqual([
      { label: "Final exam", weight: 0 },
    ]);
  });

  it("leaves the exam out once the student removed it", () => {
    expect(sheetFromTasks([task("מפגש", "2026-10-01")], new Set([FINAL_SKIP]))).toBeNull();
    expect(sheetFromTasks([task("ממן 1", "2026-11-01")], new Set([FINAL_SKIP]))).toEqual([
      { label: "ממן 1", weight: 0 },
    ]);
  });

  it("starts a sheet from the final alone, weight left to the student", () => {
    const sheet = sheetFromTasks([
      task("מפגש", "2026-10-01"),
      task("Final Exam – Java", "2027-01-28", { isFinal: true, isImported: false }),
    ]);
    expect(sheet).toEqual([{ label: "Final Exam – Java", weight: 0 }]);
  });

  it("ignores tasks the student wrote themselves", () => {
    expect(
      sheetFromTasks([
        task("לסיים ממן 11", "2026-11-01", { isImported: false }),
        task("ממן 11", "2026-11-01", { isImported: false }),
      ])
    ).toEqual([{ label: "Final exam", weight: 0 }]);
  });

  it("orders assignments by due date, final last, all unweighted", () => {
    const sheet = sheetFromTasks([
      task("מטלה 12", "2026-12-01"),
      task("בחינת גמר", "2027-01-28", { isFinal: true }),
      task("מטלה 11", "2026-11-01"),
      task("מטלה 13", "2027-01-01"),
    ]);
    expect(sheet).toEqual([
      { label: "מטלה 11", weight: 0 },
      { label: "מטלה 12", weight: 0 },
      { label: "מטלה 13", weight: 0 },
      { label: "בחינת גמר", weight: 0 },
    ]);
  });

  it("keeps one row per assignment when a name repeats", () => {
    const sheet = sheetFromTasks([task("מטלה 11", "2026-11-01"), task("מטלה 11", "2026-11-02")])!;
    expect(sheet.filter((i) => i.label === "מטלה 11")).toHaveLength(1);
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
    expect(out.map((i) => i.weight)).toEqual([0, 0, 0]);
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

  it("keeps a row the student added even before it has a name or weight", () => {
    const mine: GradeItem[] = [
      { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 30 },
      { id: "2", label: "", weight: 0, manual: true },
    ];
    const out = reconcileWithImport(mine, imported, ids())!;
    expect(out.find((i) => i.id === "2")).toEqual({ id: "2", label: "", weight: 0, manual: true });
  });

  it("keeps a lone blank row the student added instead of rebuilding the sheet", () => {
    const out = reconcileWithImport([{ id: "x", label: "Quiz", weight: 0, manual: true }], imported, ids())!;
    expect(out[0]).toEqual({ id: "x", label: "Quiz", weight: 0, manual: true });
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

  it("keeps a sheet with nothing imported as it is, plus its exam row", () => {
    const mine: GradeItem[] = [{ id: "1", label: "Lab work", weight: 100 }];
    const out = reconcileWithImport(mine, [task("מפגש", "2026-10-01")], ids())!;
    expect(out[0]).toEqual(mine[0]);
    expect(out[1]).toMatchObject({ label: "Final exam", weight: 0 });
    // Without the exam either, there's nothing to line up.
    expect(reconcileWithImport(mine, [], ids(), new Set([FINAL_SKIP]))).toBeNull();
  });
});

describe("mergeMissingFinal", () => {
  const final = task("Final Exam – Java", "2027-01-28", { isFinal: true, isImported: false });

  it("adds the final unweighted, leaving the rest alone", () => {
    const sheet: GradeItem[] = [
      { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 10 },
      { id: "2", label: 'מטלה 02 (ממ"ן)', weight: 20 },
    ];
    const out = mergeMissingFinal(sheet, [final], ids());
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ label: "Final Exam – Java", weight: 0 });
    expect(out.slice(0, 2)).toEqual(sheet);
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

  it("adds an exam row even before a final date is set", () => {
    const sheet: GradeItem[] = [{ id: "1", label: "Project", weight: 50 }];
    const out = mergeMissingFinal(sheet, [task('מטלה 01 (ממ"ן)', "2026-11-13")], ids());
    expect(out[1]).toMatchObject({ label: "Final exam", weight: 0 });
  });

  it("doesn't put back an exam row the student removed", () => {
    const sheet: GradeItem[] = [{ id: "1", label: "Project", weight: 100 }];
    expect(mergeMissingFinal(sheet, [final], ids(), new Set([FINAL_SKIP]))).toBe(sheet);
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

describe("applyWeights", () => {
  const sheet: GradeItem[] = [
    { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 0, score: 90 },
    { id: "2", label: "בחינת גמר", weight: 0 },
  ];

  it("sets the weights given and keeps scores", () => {
    const out = applyWeights(sheet, [
      { label: 'מטלה 01 (ממ"ן)', weight: 10 },
      { label: "בחינת גמר", weight: 90 },
    ], ids());
    expect(out).toEqual([
      { id: "1", label: 'מטלה 01 (ממ"ן)', weight: 10, score: 90 },
      { id: "2", label: "בחינת גמר", weight: 90 },
    ]);
  });

  it("keeps an exam weight the student gave off auto", () => {
    const out = applyWeights(sheet, [
      { label: 'מטלה 01 (ממ"ן)', weight: 10 },
      { label: "בחינת גמר", weight: 70 },
    ], ids());
    expect(out[1]).toMatchObject({ weight: 70, fixedWeight: true });
  });

  it("matches an assignment by its number and leaves blank rows alone", () => {
    const out = applyWeights(sheet, [{ label: "ממן 1", weight: 15 }, { label: "בחינת גמר", weight: null }], ids());
    expect(out.map((i) => i.weight)).toEqual([15, 0]);
  });

  it("builds a sheet when the course has none", () => {
    const out = applyWeights(undefined, [{ label: "Project", weight: 40 }, { label: "Exam", weight: null }], ids());
    expect(out.map((i) => [i.label, i.weight])).toEqual([["Project", 40], ["Exam", 0]]);
  });
});

describe("orderSheet", () => {
  it("puts assignments in number order, the student's rows next, the final last", () => {
    const rows = [
      { label: 'מטלה 01 (ממ"ן)' },
      { label: "בחינת גמר" },
      { label: 'מטלה 05 (ממ"ן)' },
      { label: "Lab" },
      { label: 'מטלה 03 (ממ"ן)' },
      { label: 'מטלה 02 (ממ"ן)' },
      { label: "Quiz" },
    ];
    expect(orderSheet(rows).map((r) => r.label)).toEqual([
      'מטלה 01 (ממ"ן)',
      'מטלה 02 (ממ"ן)',
      'מטלה 03 (ממ"ן)',
      'מטלה 05 (ממ"ן)',
      "Lab",
      "Quiz",
      "בחינת גמר",
    ]);
  });
});

describe("withAutoExam", () => {
  const sheet = (weights: number[], exam = 0, fixed = false): GradeItem[] => [
    ...weights.map((w, i) => ({ id: `a${i}`, label: `מטלה 0${i + 1}`, weight: w })),
    { id: "x", label: "Final exam", weight: exam, ...(fixed ? { fixedWeight: true } : {}) },
  ];

  it("gives the exam what the assignments leave", () => {
    expect(withAutoExam(sheet([4, 4, 4, 4, 4])).at(-1)!.weight).toBe(80);
  });

  it("moves a skipped assignment's share onto the exam", () => {
    expect(withAutoExam(sheet([4, 4, 4, 0, 0])).at(-1)!.weight).toBe(88);
  });

  it("waits until some other row has a weight", () => {
    const s = sheet([0, 0, 0]);
    expect(withAutoExam(s)).toBe(s);
  });

  it("leaves the exam what a cap on the assignments leaves", () => {
    expect(withAutoExam(sheet([4, 4, 4, 4, 4]), 12).at(-1)!.weight).toBe(88);
  });

  it("leaves an exam weight the student typed", () => {
    expect(withAutoExam(sheet([4, 4], 70, true)).at(-1)!.weight).toBe(70);
  });
});

describe("countedRows", () => {
  const rows = (scores: (number | undefined)[]): GradeItem[] => [
    ...scores.map((s, i) => ({ id: `a${i + 1}`, label: `מטלה 0${i + 1}`, weight: 4, ...(s === undefined ? {} : { score: s }) })),
    { id: "x", label: "Final exam", weight: 88 },
  ];

  it("counts every row without a cap, or under it", () => {
    expect(countedRows(rows([90, 80]), undefined).dropped.size).toBe(0);
    expect(countedRows(rows([90, 80]), 12).dropped.size).toBe(0);
  });

  it("keeps the best marks up to the cap and drops the rest", () => {
    const { dropped } = countedRows(rows([70, 95, 60, 85, undefined]), 12);
    expect([...dropped].sort()).toEqual(["a3", "a5"]);
  });

  it("holds room under the cap for unmarked assignments", () => {
    const { counted, dropped } = countedRows(rows([90, undefined, undefined, undefined, undefined]), 12);
    expect(counted.map((i) => i.id)).toEqual(["a1", "a2", "a3", "x"]);
    expect([...dropped].sort()).toEqual(["a4", "a5"]);
  });
});

describe("countedRows with mixed weights", () => {
  it("takes whole assignments that still fit under the cap", () => {
    const items: GradeItem[] = [
      { id: "a", label: "מטלה 01", weight: 5, score: 100 },
      { id: "b", label: "מטלה 02", weight: 10, score: 90 },
      { id: "c", label: "מטלה 03", weight: 5, score: 80 },
      { id: "x", label: "Final exam", weight: 85 },
    ];
    // Best first: 01 (5) fits, 02 (10) would make 15, 03 (5) makes 10.
    expect([...countedRows(items, 12).dropped]).toEqual(["b"]);
  });
});

