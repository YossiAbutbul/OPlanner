import type { TableData } from "./csv";

// Open University "תכניות לימודים אישיות" (personal study program). The page,
// and the PDF printed from it, list every course as:
//
//   20109 - אלגברה לינארית 1 7 סטטוס: הצלחה
//   רמה: רגיל
//   סמסטר: 2023 א
//   נכלל? כן
//
// Copy the page (or the PDF text) and paste it in. This adapter flattens that
// block shape into the same table every other adapter produces.

const CODE_LINE = /^\s*(\d{5})\s*[-–—]\s*(.+)$/;
const STATUS_PREFIX = /^\s*סטטוס\s*:\s*(.*)$/;
const LEVEL_PREFIX = /^\s*רמה\s*:\s*(.*)$/;
const TERM_PREFIX = /^\s*סמסטר\s*:\s*(.*)$/;
const COUNTS_PREFIX = /^\s*נכלל\s*\?\s*(.*)$/;
const PROGRAM_CREDITS = /נקודות\s+זכות\s+בתכנית\s*:?\s*(\d+)/;

// Page furniture from the printed PDF: header, footer, page numbers, and the
// summary tables that follow the course list.
const NOISE = [
  /https?:\/\//,
  /^\s*\d+\s*\/\s*\d+\s*$/,
  /תכניות\s+לימודים\s+אישיות/,
  /^\s*שם\s*:/,
  /סיכום\s+נקודות\s+זכות/,
  /השלמת\s+חובות\s+אקדמיות/,
  /הערות\s+הסטודנט/,
  /הוספת\s+הערות/,
  /^\s*קורס\s+נ/,
];

const isNoise = (line: string) => NOISE.some((re) => re.test(line));

interface OuCourse {
  code: string;
  name: string;
  credits: string;
  status: string;
  level: string;
  term: string;
  counts: string;
}

const blank = (code: string, name: string): OuCourse => ({
  code,
  name,
  credits: "",
  status: "",
  level: "",
  term: "",
  counts: "",
});

// "אלגברה לינארית 1 7" -> name "אלגברה לינארית 1", credits "7". A trailing
// number is the credit count; a name that ends in a word (or in a digit that
// is part of the title, like "חשבון אינפיניטסימלי 1") keeps it.
const splitNameAndCredits = (text: string): { name: string; credits: string } => {
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^\d{1,2}(\.\d)?$/.test(last) && Number(last) <= 30) {
      return { name: parts.slice(0, -1).join(" "), credits: last };
    }
  }
  return { name: parts.join(" "), credits: "" };
};

export const detectOpenU = (text: string): number => {
  const hasCodes = /(^|\n)\s*\d{5}\s*[-–—]\s*\S/.test(text);
  const hasStatus = /סטטוס\s*:/.test(text);
  const hasIncluded = /נכלל\s*\?/.test(text);
  if (hasCodes && hasStatus && hasIncluded) return 0.97;
  if (hasCodes && hasStatus) return 0.8;
  return 0;
};

export const parseOpenU = (text: string): TableData => {
  const lines = text.split(/\r?\n/);
  const courses: OuCourse[] = [];
  let current: OuCourse | null = null;

  const flush = () => {
    if (current && current.name) courses.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isNoise(line)) continue;

    const codeMatch = line.match(CODE_LINE);
    if (codeMatch) {
      flush();
      // The status often rides along on the course line.
      const [head, tail] = codeMatch[2].split(/סטטוס\s*:/);
      const { name, credits } = splitNameAndCredits(head);
      current = blank(codeMatch[1], name);
      current.credits = credits;
      if (tail !== undefined) current.status = tail.trim();
      continue;
    }

    if (!current) continue;

    const status = line.match(STATUS_PREFIX);
    if (status) {
      current.status = status[1].trim();
      continue;
    }
    const level = line.match(LEVEL_PREFIX);
    if (level) {
      current.level = level[1].trim();
      continue;
    }
    const term = line.match(TERM_PREFIX);
    if (term) {
      current.term = term[1].trim();
      continue;
    }
    const counts = line.match(COUNTS_PREFIX);
    if (counts) {
      current.counts = counts[1].trim();
      continue;
    }
    // A bare number right after the course line is its credit count.
    if (!current.credits && /^\d{1,2}(\.\d)?$/.test(line)) {
      current.credits = line;
    }
  }
  flush();

  return {
    headers: ["Code", "Course", "Credits", "Status", "Group", "Term", "Counts"],
    rows: courses.map((c) => [c.code, c.name, c.credits, c.status, c.level, c.term, c.counts]),
  };
};

// Extra facts the page carries beyond the course list.
export const openUMeta = (text: string): { programCredits?: number } => {
  const m = text.match(PROGRAM_CREDITS);
  return m ? { programCredits: Number(m[1]) } : {};
};
