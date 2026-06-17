import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { CourseLink, CourseMeta, ExamColumn, ExamRow, ExamTable } from "../types/models";

// Firestore path of the course doc itself (links/notes/info live on it,
// alongside the existing color/finalDate fields).
const coursePath = (uid: string, year: number, semester: string, course: string) =>
  `users/${uid}/years/${year}/semesters/${semester}/courses/${course}`;

export const MAX_LINKS = 20;
export const MAX_LABEL_LEN = 100;
export const MAX_URL_LEN = 2000;
export const MAX_COURSE_NOTES_LEN = 50000;
export const MAX_EXAM_COLUMNS = 60;
export const MAX_EXAM_ROWS = 100;
export const MAX_EXAM_LABEL_LEN = 120;

// http(s) only — same philosophy as the notes editor's ALLOWED_URI_REGEXP.
// new URL() rejects things the prefix check alone would let through ("http://").
export const isValidLinkUrl = (url: string): boolean => {
  if (typeof url !== "string" || url.length > MAX_URL_LEN) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// Hostname → icon bucket for the links list. Local lucide icons only —
// CSP img-src forbids fetching favicons from arbitrary hosts.
export type LinkIconType =
  | "moodle"
  | "zoom"
  | "drive"
  | "github"
  | "youtube"
  | "docs"
  | "generic";

export const linkIconType = (url: string): LinkIconType => {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "generic";
  }
  if (host.includes("moodle")) return "moodle";
  if (host.includes("zoom.")) return "zoom";
  if (host.includes("drive.google") || host.includes("onedrive") || host.includes("sharepoint"))
    return "drive";
  if (host.includes("github.")) return "github";
  if (host.includes("youtube.") || host === "youtu.be") return "youtube";
  if (host.includes("docs.google") || host.includes("notion.")) return "docs";
  return "generic";
};

// Drop anything malformed coming back from Firestore (or a stale cache):
// non-string fields, invalid URLs, out-of-range credits. Legacy docs without
// the new fields normalize to {}.
export const normalizeCourseMeta = (data: unknown): CourseMeta => {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const meta: CourseMeta = {};

  if (Array.isArray(d.links)) {
    const links = d.links
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .filter(
        (l) =>
          typeof l.id === "string" &&
          typeof l.label === "string" &&
          typeof l.url === "string" &&
          isValidLinkUrl(l.url)
      )
      .slice(0, MAX_LINKS)
      .map((l) => ({ id: l.id, label: l.label, url: l.url } as CourseLink));
    if (links.length) meta.links = links;
  }

  if (typeof d.courseNotes === "string" && d.courseNotes.length <= MAX_COURSE_NOTES_LEN)
    meta.courseNotes = d.courseNotes;

  const examTable = normalizeExamTable(d.examTable);
  if (examTable) meta.examTable = examTable;

  return meta;
};

// Drop malformed exam-table data: non-string ids/labels, oversized labels,
// over-limit column/row counts, and check entries that don't map to a known
// column id (so deleted columns can't leave orphaned booleans behind).
const normalizeExamTable = (data: unknown): ExamTable | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;

  const columns: ExamColumn[] = Array.isArray(d.columns)
    ? d.columns
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .filter((c) => typeof c.id === "string" && typeof c.label === "string")
        .slice(0, MAX_EXAM_COLUMNS)
        .map((c) => ({ id: c.id as string, label: (c.label as string).slice(0, MAX_EXAM_LABEL_LEN) }))
    : [];

  const colIds = new Set(columns.map((c) => c.id));

  const rows: ExamRow[] = Array.isArray(d.rows)
    ? d.rows
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .filter((r) => typeof r.id === "string" && typeof r.label === "string")
        .slice(0, MAX_EXAM_ROWS)
        .map((r) => {
          const checks: Record<string, boolean> = {};
          if (r.checks && typeof r.checks === "object") {
            for (const [k, v] of Object.entries(r.checks as Record<string, unknown>)) {
              if (colIds.has(k) && v === true) checks[k] = true;
            }
          }
          return { id: r.id as string, label: (r.label as string).slice(0, MAX_EXAM_LABEL_LEN), checks };
        })
    : [];

  if (!columns.length && !rows.length) return undefined;
  return { columns, rows };
};

export const fetchCourseMeta = async (
  uid: string,
  year: number,
  semester: string,
  course: string
): Promise<CourseMeta> => {
  const snap = await getDoc(doc(db, coursePath(uid, year, semester, course)));
  return normalizeCourseMeta(snap.data());
};

// Merge-write only the changed keys; never touches color/finalDate/tasks.
export const saveCourseMeta = async (
  uid: string,
  year: number,
  semester: string,
  course: string,
  patch: Partial<CourseMeta>
): Promise<void> => {
  await setDoc(doc(db, coursePath(uid, year, semester, course)), patch, { merge: true });
};
