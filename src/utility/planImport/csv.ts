// Delimited-text parsing for the Study Plan import: CSV, TSV, semicolon
// files and text pasted straight out of a portal page. No dependency —
// the format is small enough to parse honestly here.

const DELIMITERS = [",", "\t", ";", "|"] as const;

// Count a delimiter only outside quotes, so "Calculus 1, part 2" doesn't
// make a comma file look wider than it is. A quote only opens a cell when it
// is the cell's first character — Hebrew headers like נק"ז carry a bare
// gershayim mid-word and must not swallow the rest of the line.
const countOutsideQuotes = (line: string, delim: string): number => {
  let count = 0;
  let inQuotes = false;
  let atCellStart = true;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (inQuotes || atCellStart)) {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      atCellStart = false;
    } else if (!inQuotes && ch === delim) {
      count++;
      atCellStart = true;
    } else if (ch !== " " || !atCellStart) {
      atCellStart = false;
    }
  }
  return count;
};

// The delimiter whose column count is both highest and most consistent
// across the first lines wins.
export const detectDelimiter = (text: string): string => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12);
  if (lines.length === 0) return ",";

  let best = ",";
  let bestScore = -1;
  for (const delim of DELIMITERS) {
    const counts = lines.map((l) => countOutsideQuotes(l, delim));
    const max = Math.max(...counts);
    if (max === 0) continue;
    const consistent = counts.filter((c) => c === max).length / counts.length;
    const score = max * consistent;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }

  // Nothing delimited found: fall back to runs of 2+ spaces (pasted tables).
  if (bestScore <= 0 && lines.some((l) => /\S {2,}\S/.test(l))) return "  ";
  return best;
};

// Split one line, honoring RFC-4180 style double quotes.
const splitLine = (line: string, delim: string): string[] => {
  if (delim === "  ") return line.split(/ {2,}/).map((c) => c.trim());

  const out: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    // Same rule as countOutsideQuotes: a quote is only special at cell start.
    if (ch === '"' && (inQuotes || cell.trim() === "")) {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell.trim());
  return out;
};

export interface TableData {
  headers: string[];
  rows: string[][];
}

// Parse delimited text into a header row plus body rows. Rows with fewer
// cells than the header are padded, longer rows are trimmed, so the column
// mapping always lines up.
export const parseDelimited = (text: string): TableData => {
  const clean = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0], delim);
  const width = headers.length;
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delim);
    if (cells.length < width) return [...cells, ...Array(width - cells.length).fill("")];
    return cells.slice(0, width);
  });

  return { headers, rows };
};

// Confidence that this text is a delimited table we can read.
export const detectDelimited = (text: string): number => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return 0;
  if (/<\s*(table|html|body)\b/i.test(text)) return 0;
  const delim = detectDelimiter(text);
  const cols = delim === "  " ? lines[0].split(/ {2,}/).length : countOutsideQuotes(lines[0], delim) + 1;
  if (cols < 2) return 0;
  return delim === "  " ? 0.5 : 0.8;
};
