import type { PlanCourse, PlanCourseStatus } from "../../types/models";

// Fields an imported column can map onto. "ignore" drops the column.
export type PlanField =
  | "ignore"
  | "code"
  | "name"
  | "credits"
  | "grade"
  | "term"
  | "year"
  | "semester"
  | "group"
  | "cost"
  | "status"
  | "counts";

export interface RawPlanRow {
  code?: string;
  name?: string;
  credits?: number;
  grade?: number;
  year?: number;
  semester?: string;
  group?: string;
  cost?: number;
  status?: PlanCourseStatus;
  passFail?: boolean;
  countsToward?: boolean;
}

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// Header aliases, Hebrew and English. Matching is case-insensitive on a
// stripped form of the header, so "נק\"ז" and "נקז" both hit.
const FIELD_ALIASES: Record<Exclude<PlanField, "ignore">, string[]> = {
  code: ["code", "coursecode", "coursenumber", "courseno", "catalog", "id", "מספרקורס", "קודקורס", "מסקורס", "מספר"],
  name: ["name", "course", "coursename", "title", "subject", "שםהקורס", "שםקורס", "קורס", "שם"],
  credits: ["credits", "credit", "points", "creditpoints", "cr", "נקז", "נקודותזכות", "נקודות", "זכות"],
  grade: ["grade", "score", "mark", "finalgrade", "result", "ציון", "ציוןסופי", "ציונים"],
  term: ["term", "semesterandyear", "period", "תקופה", "מועד"],
  year: ["year", "academicyear", "שנה", "שנתלימודים", "שנהאקדמית"],
  semester: ["semester", "sem", "סמסטר"],
  group: ["group", "category", "type", "requirement", "kind", "קבוצה", "סוג", "אשכול", "חובהבחירה"],
  cost: ["cost", "price", "tuition", "amount", "paid", "עלות", "מחיר", "שכרלימוד", "תשלום"],
  status: ["status", "state", "סטטוס", "מצב"],
  counts: ["counts", "counted", "included", "include", "נכלל", "נכללבתכנית"],
};

const stripHeader = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_\-."'`׳״/()[\]]/g, "")
    .trim();

// Best-guess field for a column header. Exact alias hits win over prefix hits
// so "credits" never resolves to "code".
export const guessField = (header: string): PlanField => {
  const h = stripHeader(header);
  if (!h) return "ignore";
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field as PlanField;
  }
  // Prefix match only. Substring matching is too eager: "Remarks column"
  // contains "mark" and would otherwise read as a grade column.
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => a.length >= 3 && (h.startsWith(a) || a.startsWith(h)))) {
      return field as PlanField;
    }
  }
  return "ignore";
};

// Map every header to a field, keeping the first winner per field so a
// duplicate "grade" column doesn't overwrite the real one.
export const guessMapping = (headers: string[]): PlanField[] => {
  const taken = new Set<PlanField>();
  return headers.map((h) => {
    const field = guessField(h);
    if (field === "ignore" || taken.has(field)) return "ignore";
    taken.add(field);
    return field;
  });
};

// "1,234.5" / "85" / "٣" -> number. Blank, "-" and text return null.
export const parseNumberLoose = (value: string | undefined): number | null => {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/[₪$€£,\s]/g, "")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const EXEMPT_WORDS = ["פטור", "exempt", "exemption"];
const PASS_WORDS = ["עובר", "pass", "passed", "השלים", "זכאי"];
const FAIL_WORDS = ["נכשל", "fail", "failed", "לאעבר"];
const INPROGRESS_WORDS = ["בתהליך", "טרםנקבע", "inprogress", "ongoing", "current", "registered", "רשום"];

const hasWord = (haystack: string, words: string[]) =>
  words.some((w) => haystack.includes(w));

export interface GradeCell {
  grade?: number;
  status?: PlanCourseStatus;
  passFail?: boolean;
}

// A grade cell can hold a number, a word ("פטור", "pass") or nothing.
export const parseGradeCell = (value: string | undefined): GradeCell => {
  if (!value) return {};
  const raw = String(value).trim();
  if (!raw) return {};
  const flat = stripHeader(raw);

  const n = parseNumberLoose(raw);
  if (n !== null && n >= 0 && n <= 100) return { grade: n };

  if (hasWord(flat, EXEMPT_WORDS)) return { status: "EXEMPT", passFail: true };
  if (hasWord(flat, PASS_WORDS)) return { status: "COMPLETED", passFail: true };
  if (hasWord(flat, FAIL_WORDS)) return { status: "FAILED" };
  if (hasWord(flat, INPROGRESS_WORDS)) return { status: "IN_PROGRESS" };
  return {};
};

const SEMESTER_BY_LETTER: Record<string, string> = {
  a: "Semester A",
  b: "Semester B",
  c: "Semester C",
  "א": "Semester A",
  "ב": "Semester B",
  "ג": "Semester C",
};

export interface TermCell {
  year?: number;
  semester?: string;
}

// "2026 א", "Semester B 2025", "תשפ\"ו ב", "2025b" -> { year, semester }.
export const parseTermCell = (value: string | undefined): TermCell => {
  if (!value) return {};
  const raw = String(value).trim();
  if (!raw) return {};
  const out: TermCell = {};

  const yearMatch = raw.match(/(20\d{2})/);
  if (yearMatch) out.year = Number(yearMatch[1]);

  const lower = raw.toLowerCase();
  const worded = lower.match(/(?:semester|sem|סמסטר)\s*([abcאבג])/);
  const trailing = lower.match(/(?:^|[^a-zא-ת])([abcאבג])(?:$|[^a-zא-ת])/);
  const letter = worded?.[1] ?? trailing?.[1];
  if (letter && SEMESTER_BY_LETTER[letter]) out.semester = SEMESTER_BY_LETTER[letter];

  return out;
};

const STATUS_WORDS: Record<string, PlanCourseStatus> = {
  completed: "COMPLETED",
  complete: "COMPLETED",
  done: "COMPLETED",
  הושלם: "COMPLETED",
  inprogress: "IN_PROGRESS",
  current: "IN_PROGRESS",
  בתהליך: "IN_PROGRESS",
  planned: "PLANNED",
  future: "PLANNED",
  מתוכנן: "PLANNED",
  exempt: "EXEMPT",
  פטור: "EXEMPT",
  failed: "FAILED",
  נכשל: "FAILED",
  dropped: "DROPPED",
  בוטל: "DROPPED",
  // Open University wording.
  הצלחה: "COMPLETED",
  בלימוד: "IN_PROGRESS",
  רשום: "IN_PROGRESS",
  כישלון: "FAILED",
  ביטול: "DROPPED",
};

export const parseStatusCell = (value: string | undefined): PlanCourseStatus | undefined =>
  value ? STATUS_WORDS[stripHeader(value)] : undefined;

// Turn one raw text row into a normalized row. Returns null when the row
// carries no usable course (no name and no code).
export const rowFromCells = (
  cells: string[],
  mapping: PlanField[],
  passMark: number
): RawPlanRow | null => {
  const row: RawPlanRow = {};
  cells.forEach((cell, i) => {
    const field = mapping[i];
    if (!field || field === "ignore") return;
    const text = (cell ?? "").trim();
    if (!text) return;

    switch (field) {
      case "code":
        row.code = text.replace(/\s+/g, "");
        break;
      case "name":
        row.name = text.replace(/\s+/g, " ");
        break;
      case "credits": {
        const n = parseNumberLoose(text);
        if (n !== null && n >= 0 && n <= 30) row.credits = n;
        break;
      }
      case "grade": {
        const g = parseGradeCell(text);
        if (g.grade !== undefined) row.grade = g.grade;
        if (g.status) row.status = g.status;
        if (g.passFail) row.passFail = true;
        break;
      }
      case "term": {
        const t = parseTermCell(text);
        if (t.year) row.year = t.year;
        if (t.semester) row.semester = t.semester;
        break;
      }
      case "year": {
        const n = parseNumberLoose(text);
        if (n !== null && n >= 1900 && n <= 2200) row.year = n;
        break;
      }
      case "semester": {
        const t = parseTermCell(text);
        if (t.semester) row.semester = t.semester;
        if (t.year && !row.year) row.year = t.year;
        break;
      }
      case "group":
        row.group = text.replace(/\s+/g, " ");
        break;
      case "cost": {
        const n = parseNumberLoose(text);
        if (n !== null) row.cost = n;
        break;
      }
      case "status": {
        const s = parseStatusCell(text);
        if (s) row.status = s;
        break;
      }
      case "counts": {
        // "נכלל? כן" / "Included: no" — whether the course counts toward
        // the degree at all.
        const flat = stripHeader(text);
        if (["לא", "no", "false", "0"].includes(flat)) row.countsToward = false;
        else if (["כן", "yes", "true", "1"].includes(flat)) row.countsToward = true;
        break;
      }
    }
  });

  if (!row.name && !row.code) return null;
  if (!row.name) row.name = row.code as string;

  // A numeric grade decides the status when the sheet didn't carry one.
  if (!row.status && row.grade !== undefined) {
    row.status = row.grade >= passMark ? "COMPLETED" : "FAILED";
  }
  if (!row.status) row.status = "PLANNED";

  return row;
};

// Dedupe key: catalog code when present, else name + term.
export const rowKey = (row: { code?: string; name?: string; year?: number; semester?: string }): string => {
  if (row.code) return `c:${row.code.toLowerCase()}`;
  const name = (row.name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `n:${name}|${row.year ?? ""}|${row.semester ?? ""}`;
};

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface DiffEntry {
  kind: "new" | "update" | "same";
  row: RawPlanRow;
  existing?: PlanCourse;
  changes: FieldChange[];
}

const show = (v: unknown): string =>
  v === undefined || v === null || v === "" ? "—" : String(v);

const STATUS_LABEL: Record<PlanCourseStatus, string> = {
  COMPLETED: "completed",
  IN_PROGRESS: "in progress",
  PLANNED: "planned",
  EXEMPT: "exempt",
  FAILED: "failed",
  DROPPED: "dropped",
};

// Compare parsed rows against what is already stored. Rows that change
// nothing land in "same" so the preview can stay honest about the count.
export const diffRows = (rows: RawPlanRow[], existing: PlanCourse[]): DiffEntry[] => {
  const byKey = new Map<string, PlanCourse>();
  existing.forEach((c) => byKey.set(rowKey(c), c));

  return rows.map((row) => {
    const match = byKey.get(rowKey(row));
    if (!match) return { kind: "new", row, changes: [] };

    const changes: FieldChange[] = [];
    const push = (field: string, from: unknown, to: unknown) => {
      if (to === undefined || to === null || to === "") return;
      if (String(from ?? "") === String(to)) return;
      changes.push({ field, from: show(from), to: show(to) });
    };

    push("name", match.name, row.name);
    push("credits", match.credits, row.credits);
    push("grade", match.grade, row.grade);
    push("year", match.year, row.year);
    push("semester", match.semester, row.semester);
    if (row.status && row.status !== match.status) {
      changes.push({
        field: "status",
        from: STATUS_LABEL[match.status],
        to: STATUS_LABEL[row.status],
      });
    }

    return {
      kind: changes.length ? "update" : "same",
      row,
      existing: match,
      changes,
    };
  });
};

// Merge a parsed row onto an existing course (or onto a fresh one). Blank
// cells never wipe data that is already stored.
export const applyRow = (
  row: RawPlanRow,
  base: PlanCourse | undefined,
  source: string
): PlanCourse => {
  const now = Date.now();
  const merged: PlanCourse = base
    ? { ...base }
    : {
        id: crypto.randomUUID(),
        name: row.name ?? "Untitled course",
        credits: 0,
        status: "PLANNED",
        updatedAt: now,
      };

  if (row.code) merged.code = row.code;
  if (row.name) merged.name = row.name;
  if (row.credits !== undefined) merged.credits = row.credits;
  if (row.grade !== undefined) merged.grade = row.grade;
  if (row.year !== undefined) merged.year = row.year;
  if (row.semester) merged.semester = row.semester;
  if (row.cost !== undefined) merged.costOverride = row.cost;
  if (row.status) merged.status = row.status;
  if (row.passFail) merged.passFail = true;
  if (row.countsToward === false) merged.countsToward = false;
  else if (row.countsToward === true) delete merged.countsToward;
  merged.source = source;
  merged.updatedAt = now;

  return merged;
};
