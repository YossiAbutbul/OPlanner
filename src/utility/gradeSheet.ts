import type { GradeItem } from "../types/models";

// Names the Open University calendar and students themselves use for a graded
// assignment: ממ"ן / ממן, ממ"ח / ממח, מטלה (מטלה מקוונת included), אופל, and
// the transliterations. The quote mark varies (" ״ ') and is often left out,
// so the gap between ממ and the last letter is optional.
//
// Anchored at the start on purpose: an assignment is *named* for itself
// ("מטלה 04 (ממ\"ן)"), while a task that merely mentions one is the student's
// own todo ("לסיים ממן 11") and already lives on their task list. Taking
// those too put the same assignment on the sheet twice.
const ASSIGNMENT_PATTERNS = [
  /^ממ\s*["״']?\s*[ןנחםמ]/,
  /^מטלה/,
  /^אופל/,
  /^maman/i,
  /^mamah/i,
  /^mamach/i,
  /^assignment/i,
];

export const isAssignmentName = (name: string): boolean => {
  const trimmed = name.trim();
  return ASSIGNMENT_PATTERNS.some((re) => re.test(trimmed));
};

// A row before it has an id: the panel adds one.
export interface DraftItem {
  label: string;
  weight: number;
}


export interface TaskLike {
  name: string;
  dueDate: string;
  isFinal?: boolean;
  // Came from the university calendar rather than from the student. Only
  // these build the sheet: "לסיים ממן 11" is a todo about an assignment, and
  // the assignment itself is already in the import.
  isImported?: boolean;
}

const byDueDate = (a: TaskLike, b: TaskLike) => a.dueDate.localeCompare(b.dueDate);

const assignmentsIn = (tasks: TaskLike[], skip: ReadonlySet<string>): TaskLike[] => {
  const seen = new Set<string>();
  return tasks
    .filter(
      (t) =>
        t.isImported &&
        !t.isFinal &&
        isAssignmentName(t.name) &&
        !skip.has(assignmentKey(t.name))
    )
    .sort(byDueDate)
    .filter((t) => {
      const key = t.name.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * Build a sheet from the course's own tasks: one row per assignment in
 * due-date order, plus the final. Every row starts at weight 0: the split is
 * the course's rule, not something to guess, so the student (or the
 * assistant, from what they tell it) sets it. Null when nothing in the
 * course looks like an assignment, so the caller can fall back.
 */
export const sheetFromTasks = (
  tasks: TaskLike[],
  skip: ReadonlySet<string> = new Set()
): DraftItem[] | null => {
  const assignments = assignmentsIn(tasks, skip);
  const finalTask = tasks.find((t) => t.isFinal);
  const final = finalTask && !skip.has(assignmentKey(finalTask.name)) ? finalTask : undefined;
  if (!assignments.length && !final) return null;
  const items: DraftItem[] = assignments.map((t) => ({ label: t.name.trim(), weight: 0 }));
  // Setting a final date on the overview is enough to start a sheet.
  if (final) items.push({ label: final.name.trim() || "Final exam", weight: 0 });
  return items;
};

// A row already standing in for the exam, whatever the student called it.
const FINAL_PATTERNS = [/^final/i, /^exam/i, /בחינ/, /מבחן/];

const looksLikeFinal = (label: string) => {
  const trimmed = label.trim();
  return FINAL_PATTERNS.some((re) => re.test(trimmed));
};

/**
 * Put the course's final on the sheet once a date is set for it on the
 * overview, at weight 0 like every row the panel adds itself: the student
 * says what it's worth.
 */
export const mergeMissingFinal = (
  items: GradeItem[],
  tasks: TaskLike[],
  makeId: () => string,
  skip: ReadonlySet<string> = new Set()
): GradeItem[] => {
  const final = tasks.find((t) => t.isFinal);
  if (!final || skip.has(assignmentKey(final.name))) return items;

  const label = final.name.trim() || "Final exam";
  const already = items.some((i) => i.label.trim() === label || looksLikeFinal(i.label));
  if (already) return items;

  return [...items, { id: makeId(), label, weight: 0 }];
};

// Two rows are the same assignment when they carry the same number, however
// it is written: "Assignment 01", "מטלה 1 (ממ\"ן)" and "ממן 1" are one item.
// With no number in the name, the name itself is the key.
export const assignmentKey = (label: string): string => {
  const digits = label.match(/\d+/);
  if (digits) return `#${parseInt(digits[0], 10)}`;
  return label.trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Add the assignments a course has picked up since its sheet was written.
 * Existing rows are left exactly as they are, including their weights; a new
 * row arrives at weight 0 so it never silently changes the grade, and asks
 * the student for its weight by being the only blank one.
 */
export const mergeNewAssignments = (
  items: GradeItem[],
  tasks: TaskLike[],
  makeId: () => string,
  skip: ReadonlySet<string> = new Set()
): GradeItem[] => {
  const known = new Set(items.map((i) => assignmentKey(i.label)));
  const extra = assignmentsIn(tasks, skip)
    .filter((t) => !known.has(assignmentKey(t.name)))
    .map((t) => ({ id: makeId(), label: t.name.trim(), weight: 0 }));
  return extra.length ? [...items, ...extra] : items;
};

// Rows the panel wrote itself and the student never touched: the generic
// placeholders, and the empty rows an earlier version added for todos that
// merely mentioned an assignment.
const PLACEHOLDER_LABELS = [/^assignment\s*\d+$/i, /^final exam$/i];

const isPlaceholder = (label: string) =>
  PLACEHOLDER_LABELS.some((re) => re.test(label.trim()));

// A row is the student's once they added it themselves, or it carries a
// mark or a weight they set, unless it is one of the placeholders the panel
// itself put there.
const carriesADecision = (item: GradeItem) =>
  item.manual === true ||
  item.score !== undefined ||
  (item.weight > 0 && !isPlaceholder(item.label));

/**
 * Bring a stored sheet in line with the imported calendar: keep every row the
 * student has actually filled in, drop the panel's own placeholders and empty
 * leftovers, and add the imported assignments that are missing. A sheet with
 * nothing worth keeping is rebuilt from the import outright, so its rows carry
 * the calendar's own names instead of Assignment 01.
 */
export const reconcileWithImport = (
  items: GradeItem[],
  tasks: TaskLike[],
  makeId: () => string,
  skip: ReadonlySet<string> = new Set()
): GradeItem[] | null => {
  const fromTasks = sheetFromTasks(tasks, skip);
  if (!fromTasks) return null;

  const kept = items.filter(carriesADecision);
  if (!kept.length) return fromTasks.map((d) => ({ id: makeId(), label: d.label, weight: d.weight }));
  return mergeMissingFinal(mergeNewAssignments(kept, tasks, makeId, skip), tasks, makeId, skip);
};

// A row of weights the assistant proposed: null where the student left it.
export interface WeightRow {
  label: string;
  weight: number | null;
}

/**
 * Write proposed weights onto a sheet. Each row finds its item by label, or
 * by assignment number ("מטלה 01" and "ממן 1" are one item); its weight is
 * set when the row has one and left alone when it doesn't. Scores never
 * change. A row with no matching item is added, so a course with no saved
 * sheet yet gets one from the table the student filled in.
 */
export const applyWeights = (
  items: GradeItem[] | undefined,
  rows: WeightRow[],
  makeId: () => string
): GradeItem[] => {
  const next = (items ?? []).map((i) => ({ ...i }));
  for (const r of rows) {
    const label = r.label.trim();
    if (!label) continue;
    const hit =
      next.find((i) => i.label.trim() === label) ??
      next.find((i) => assignmentKey(i.label) === assignmentKey(label));
    if (hit) {
      if (r.weight !== null) hit.weight = r.weight;
    } else {
      next.push({ id: makeId(), label, weight: r.weight ?? 0 });
    }
  }
  return next;
};
