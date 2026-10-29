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

// What the final takes when the course has one; the assignments split the rest.
const FINAL_WEIGHT = 70;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Spread `total` over `count` rows, the last absorbing the rounding. */
const split = (total: number, count: number): number[] => {
  if (count <= 0) return [];
  const each = round1(total / count);
  const parts = Array.from({ length: count }, () => each);
  parts[count - 1] = round1(total - each * (count - 1));
  return parts;
};

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
 * due-date order, plus the final. Null when nothing in the course looks like
 * an assignment, so the caller can fall back to a generic sheet.
 */
export const sheetFromTasks = (
  tasks: TaskLike[],
  skip: ReadonlySet<string> = new Set()
): DraftItem[] | null => {
  const assignments = assignmentsIn(tasks, skip);
  const finalTask = tasks.find((t) => t.isFinal);
  const final = finalTask && !skip.has(assignmentKey(finalTask.name)) ? finalTask : undefined;
  if (!assignments.length) {
    // Setting a final date on the overview is enough to start a sheet: that
    // exam is the whole grade until something else is added.
    return final ? [{ label: final.name.trim() || "Final exam", weight: 100 }] : null;
  }

  const weights = split(final ? 100 - FINAL_WEIGHT : 100, assignments.length);
  const items: DraftItem[] = assignments.map((t, i) => ({
    label: t.name.trim(),
    weight: weights[i],
  }));
  if (final) items.push({ label: final.name.trim() || "Final exam", weight: FINAL_WEIGHT });
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
 * overview. It takes whatever weight is unclaimed, so a sheet of assignments
 * adding up to 30 gives it 70 without touching a single existing row, and a
 * sheet already at 100 gets it at 0 for the student to sort out.
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

  const used = items.reduce((n, i) => n + i.weight, 0);
  return [...items, { id: makeId(), label, weight: Math.max(0, Math.round((100 - used) * 10) / 10) }];
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

// A row is the student's once it carries a mark or a weight they set, unless
// it is one of the placeholders the panel itself put there.
const carriesADecision = (item: GradeItem) =>
  item.score !== undefined || (item.weight > 0 && !isPlaceholder(item.label));

/**
 * Bring a stored sheet in line with the imported calendar: keep every row the
 * student has actually filled in, drop the panel's own placeholders and empty
 * leftovers, and add the imported assignments that are missing. A sheet with
 * nothing worth keeping is rebuilt from the import outright, so its rows carry
 * the calendar's own names and a sensible split instead of Assignment 01.
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
