import type { TableData } from "./csv";

// HTML grade sheets from university portals. The document is parsed with
// DOMParser into an inert document — nothing is ever inserted into the live
// DOM, and only text content is read out, so markup in the file cannot run.

export const detectHtmlTable = (text: string): number => {
  if (!/<\s*table\b/i.test(text)) return 0;
  return /<\s*(tr|td|th)\b/i.test(text) ? 0.95 : 0.4;
};

const cellText = (el: Element): string =>
  (el.textContent ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

// Pick the table with the most data rows — portals wrap real content in
// layout tables, and the widest one is the grade sheet.
const pickTable = (doc: Document): HTMLTableElement | null => {
  const tables = Array.from(doc.querySelectorAll("table"));
  if (tables.length === 0) return null;
  let best: HTMLTableElement | null = null;
  let bestScore = -1;
  for (const t of tables) {
    const rows = t.querySelectorAll("tr");
    const cols = rows[0]?.querySelectorAll("td, th").length ?? 0;
    const score = rows.length * Math.max(1, cols);
    if (score > bestScore) {
      bestScore = score;
      best = t as HTMLTableElement;
    }
  }
  return best;
};

export const parseHtmlTable = (text: string): TableData => {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const table = pickTable(doc);
  if (!table) return { headers: [], rows: [] };

  const trs = Array.from(table.querySelectorAll("tr"));
  if (trs.length === 0) return { headers: [], rows: [] };

  // Header row: the first row that carries <th>, else the first row.
  const headerIndex = trs.findIndex((tr) => tr.querySelector("th"));
  const headerRow = headerIndex >= 0 ? trs[headerIndex] : trs[0];
  const headers = Array.from(headerRow.querySelectorAll("th, td")).map(cellText);
  const width = headers.length;

  const bodyRows = trs
    .slice((headerIndex >= 0 ? headerIndex : 0) + 1)
    .map((tr) => Array.from(tr.querySelectorAll("td, th")).map(cellText))
    .filter((cells) => cells.some((c) => c.length > 0))
    .map((cells) =>
      cells.length < width
        ? [...cells, ...Array(width - cells.length).fill("")]
        : cells.slice(0, width)
    );

  return { headers, rows: bodyRows };
};
