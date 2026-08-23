// PDF text extraction for the Study Plan import. Portals hand out grade
// sheets and study programs as PDFs, so the importer reads them directly
// instead of asking for a copy-paste.
//
// pdf.js is loaded on demand — the parser is a large chunk and most sessions
// never import a PDF. Everything runs locally; no page is ever uploaded.

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;

// Hebrew and Arabic blocks: a line holding any of these reads right to left.
const RTL = /[\u0590-\u05FF\u0600-\u06FF]/;
// Items whose baselines are within this many units belong to the same line.
const Y_TOLERANCE = 3;
// Horizontal gap that means "there was a space here".
const SPACE_GAP = 1.2;

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

// PDFs carry positioned fragments, not lines. Group fragments by baseline,
// order each line by reading direction, and put spaces back where the
// geometry says a gap was.
export const linesFromItems = (items: PdfTextItem[]): string[] => {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) <= Y_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);

  return rows
    .map((row) => {
      const rtl = row.items.some((i) => RTL.test(i.str));
      const ordered = [...row.items].sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
      let line = "";
      let prev: PdfTextItem | null = null;
      for (const item of ordered) {
        if (prev) {
          const gap = rtl
            ? prev.x - (item.x + item.width)
            : item.x - (prev.x + prev.width);
          if (gap > SPACE_GAP && !/\s$/.test(line) && !/^\s/.test(item.str)) line += " ";
        }
        line += item.str;
        prev = item;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
};

// Loaded once per session and reused across imports.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

export const isPdf = (file: File): boolean =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/**
 * Read a PDF into plain text, one line per visual line. Throws with a message
 * meant for the user when the file can't be read or holds no text at all
 * (a scan, for instance, which would need OCR).
 */
export const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(data),
      // The importer only needs text, so skip the speculative fetching pdf.js
      // does for rendering.
      disableAutoFetch: true,
    }).promise;
  } catch {
    throw new Error("Could not open that PDF. If it is password protected, remove the password first.");
  }

  const lines: string[] = [];
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  try {
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((i): i is Extract<typeof i, { str: string }> => "str" in i)
        .map((i) => ({
          str: i.str,
          x: i.transform[4] as number,
          y: i.transform[5] as number,
          width: i.width,
        }));
      lines.push(...linesFromItems(items));
      page.cleanup();
    }
  } finally {
    void doc.cleanup();
  }

  const text = lines.join("\n");
  if (!text.trim()) {
    throw new Error("That PDF has no selectable text — it looks like a scan. Copy the table from the portal instead.");
  }
  return text;
};
