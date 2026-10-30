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

// Recorded in gradeSkips when the student deletes the exam row: the course
// has no exam, so the row isn't put back.
export const FINAL_SKIP = "#final";

// A row already standing in for the exam, whatever the student called it.
const FINAL_PATTERNS = [/^final/i, /^exam/i, /בחינ/, /מבחן/];

export const looksLikeFinal = (label: string) => {
  const trimmed = label.trim();
  return FINAL_PATTERNS.some((re) => re.test(trimmed));
};

// The exam row every sheet carries unless the student removed it: named for
// the course's final exam task when it has one, "Final exam" otherwise.
const examRow = (tasks: TaskLike[], skip: ReadonlySet<string>): string | null => {
  const finalTask = tasks.find((t) => t.isFinal);
  if (skip.has(FINAL_SKIP) || (finalTask && skip.has(assignmentKey(finalTask.name)))) return null;
  return finalTask?.name.trim() || "Final exam";
};

/**
 * Build a sheet from the course's own tasks: one row per assignment in
 * due-date order, then the exam. Every course has one unless the student
 * deleted it, so the row is there before any final date is set. Every row
 * starts at weight 0: the split is the course's rule, not something to
 * guess, so the student (or the assistant, from what they tell it) sets it.
 * Null only when there's nothing at all to put on it.
 */
export const sheetFromTasks = (
  tasks: TaskLike[],
  skip: ReadonlySet<string> = new Set()
): DraftItem[] | null => {
  const assignments = assignmentsIn(tasks, skip);
  const exam = examRow(tasks, skip);
  const items: DraftItem[] = assignments.map((t) => ({ label: t.name.trim(), weight: 0 }));
  if (exam) items.push({ label: exam, weight: 0 });
  return items.length ? items : null;
};

/**
 * Put the exam row on a sheet that lacks one, at weight 0 like every row the
 * panel adds itself: the student says what it's worth. A row already
 * standing in for the exam, under any name, counts.
 */
export const mergeMissingFinal = (
  items: GradeItem[],
  tasks: TaskLike[],
  makeId: () => string,
  skip: ReadonlySet<string> = new Set()
): GradeItem[] => {
  const label = examRow(tasks, skip);
  if (!label) return items;
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
      if (r.weight !== null && r.weight !== hit.weight) {
        hit.weight = r.weight;
        // A weight given for the exam is the student's own, not the remainder.
        if (looksLikeFinal(hit.label)) hit.fixedWeight = true;
      }
    } else {
      next.push({ id: makeId(), label, weight: r.weight ?? 0 });
    }
  }
  // An exam weight that is just the remainder stays on auto.
  const exam = next.find((i) => i.fixedWeight && looksLikeFinal(i.label));
  if (exam) {
    const others = next.reduce((n, i) => (i === exam ? n : n + i.weight), 0);
    if (Math.abs(100 - others - exam.weight) < 0.05) delete exam.fixedWeight;
  }
  return next;
};

// The number an assignment row carries ("מטלה 03 (ממ"ן)" -> 3), or null.
const assignmentNumber = (label: string): number | null => {
  if (!isAssignmentName(label)) return null;
  const digits = label.match(/\d+/);
  return digits ? parseInt(digits[0], 10) : null;
};

/**
 * The order a sheet reads in: numbered assignments by number (01, 02, 03,
 * whatever order the imports added them in), then the rows the student
 * added in their own order, then the final. Stable, so rows that tie keep
 * their place.
 */
export const orderSheet = <T extends { label: string }>(items: T[]): T[] => {
  const rank = (i: T) => (looksLikeFinal(i.label) ? 2 : assignmentNumber(i.label) !== null ? 0 : 1);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank(a.item);
      const rb = rank(b.item);
      if (ra !== rb) return ra - rb;
      if (ra === 0) {
        const d = assignmentNumber(a.item.label)! - assignmentNumber(b.item.label)!;
        if (d !== 0) return d;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
};

/**
 * The rows that count toward the grade when a course counts only its best
 * `best` assignments (the Open University's "the highest marks up to the
 * set weight"). Marked assignments are taken best first; while fewer than
 * `best` are marked, unmarked ones fill the open places, in order, as weight
 * still to come. The exam and the rest always count. `dropped` holds the ids
 * that don't. With no `best`, or at least that many assignments, every row
 * counts.
 */
export const countedRows = (
  items: GradeItem[],
  best?: number
): { counted: GradeItem[]; dropped: Set<string> } => {
  const assignments = items.filter((i) => !looksLikeFinal(i.label));
  if (!best || best >= assignments.length) return { counted: items, dropped: new Set() };
  const marked = assignments
    .filter((i) => typeof i.score === "number")
    .sort((a, b) => b.score! - a.score!)
    .slice(0, best);
  const open = assignments.filter((i) => typeof i.score !== "number").slice(0, best - marked.length);
  const keep = new Set([...marked, ...open].map((i) => i.id));
  const dropped = new Set(assignments.filter((i) => !keep.has(i.id)).map((i) => i.id));
  return { counted: items.filter((i) => !dropped.has(i.id)), dropped };
};

/**
 * The exam takes whatever the counted assignments leave: 100 minus their
 * weights. Five assignments at 4% leave it 80%; a course counting the best
 * 3 leaves it 88%; an assignment at 0 (skipped) hands its share over too.
 * Applies only once some other row has a weight, and never to an exam weight
 * the student typed.
 */
export const withAutoExam = (items: GradeItem[], best?: number): GradeItem[] => {
  const exam = items.find((i) => looksLikeFinal(i.label));
  if (!exam || exam.fixedWeight) return items;
  const rest = items.filter((i) => i !== exam).map((i) => i.weight);
  // With best-N, the heaviest N assignments are the most the sheet can count.
  const counted = best && best < rest.length ? [...rest].sort((a, b) => b - a).slice(0, best) : rest;
  const others = counted.reduce((n, w) => n + w, 0);
  if (others <= 0) return items;
  const weight = Math.max(0, Math.round((100 - others) * 10) / 10);
  return weight === exam.weight ? items : items.map((i) => (i === exam ? { ...i, weight } : i));
};

