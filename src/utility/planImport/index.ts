import { detectDelimited, parseDelimited, type TableData } from "./csv";
import { detectHtmlTable, parseHtmlTable } from "./htmlTable";
import { detectOpenU, openUMeta, parseOpenU } from "./openu";
import {
  MAX_IMPORT_ROWS,
  guessMapping,
  rowFromCells,
  type PlanField,
  type RawPlanRow,
} from "./normalize";

export * from "./normalize";
export { parseDelimited, detectDelimiter } from "./csv";
export { parseHtmlTable } from "./htmlTable";
export { parseOpenU, detectOpenU } from "./openu";
export type { TableData } from "./csv";

// An adapter reads one input shape into a header/rows table. Adding support
// for another portal export means adding an adapter here, nothing else.
export interface PlanImportAdapter {
  id: string;
  label: string;
  detect: (text: string) => number; // confidence 0..1
  parse: (text: string) => TableData;
  // Facts the source carries beyond the course rows, like the number of
  // credits the whole program requires.
  meta?: (text: string) => ImportMeta;
}

export interface ImportMeta {
  programCredits?: number;
}

export const ADAPTERS: PlanImportAdapter[] = [
  {
    id: "openu",
    label: "Open University study program",
    detect: detectOpenU,
    parse: parseOpenU,
    meta: openUMeta,
  },
  {
    id: "html-table",
    label: "HTML table",
    detect: detectHtmlTable,
    parse: parseHtmlTable,
  },
  {
    id: "delimited",
    label: "CSV or pasted text",
    detect: detectDelimited,
    parse: parseDelimited,
  },
];

// Highest-confidence adapter, with the delimited one as the last resort so
// an unknown export still reaches the column-mapping step.
export const pickAdapter = (text: string): PlanImportAdapter => {
  let best = ADAPTERS[ADAPTERS.length - 1];
  let bestScore = 0;
  for (const adapter of ADAPTERS) {
    const score = adapter.detect(text);
    if (score > bestScore) {
      bestScore = score;
      best = adapter;
    }
  }
  return best;
};

export interface ParsedImport {
  adapter: PlanImportAdapter;
  table: TableData;
  mapping: PlanField[];
  truncated: boolean;
  meta: ImportMeta;
}

// Text in, table plus a pre-filled column mapping out. Row count is capped
// so a pathological file can't lock the tab up.
export const parseImportText = (text: string): ParsedImport => {
  const adapter = pickAdapter(text);
  const table = adapter.parse(text);
  const truncated = table.rows.length > MAX_IMPORT_ROWS;
  return {
    adapter,
    table: truncated ? { ...table, rows: table.rows.slice(0, MAX_IMPORT_ROWS) } : table,
    mapping: guessMapping(table.headers),
    truncated,
    meta: adapter.meta ? adapter.meta(text) : {},
  };
};

// Apply a (possibly user-corrected) mapping to the table body.
export const rowsFromTable = (
  table: TableData,
  mapping: PlanField[],
  passMark: number
): RawPlanRow[] =>
  table.rows
    .map((cells) => rowFromCells(cells, mapping, passMark))
    .filter((r): r is RawPlanRow => r !== null);

// Fields the user can pick in the mapping step, in menu order.
export const MAPPABLE_FIELDS: { value: PlanField; label: string }[] = [
  { value: "ignore", label: "Skip this column" },
  { value: "code", label: "Course code" },
  { value: "name", label: "Course name" },
  { value: "credits", label: "Credits" },
  { value: "grade", label: "Grade" },
  { value: "term", label: "Term (year + semester)" },
  { value: "year", label: "Year" },
  { value: "semester", label: "Semester" },
  { value: "group", label: "Requirement group" },
  { value: "cost", label: "Cost" },
  { value: "status", label: "Status" },
  { value: "counts", label: "Counts toward the degree" },
];
