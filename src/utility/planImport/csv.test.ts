import { describe, expect, it } from "vitest";
import { detectDelimiter, parseDelimited } from "./csv";
import { parseHtmlTable } from "./htmlTable";
import { parseImportText, rowsFromTable } from "./index";

const csv = `Code,Course,Credits,Grade
62350,"Operating Systems, advanced",4,86
61230,Probability,3.5,54`;

describe("detectDelimiter", () => {
  it("finds commas, tabs and semicolons", () => {
    expect(detectDelimiter(csv)).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });

  it("falls back to wide spacing for pasted tables", () => {
    expect(detectDelimiter("Code   Course   Grade\n62350   OS   86")).toBe("  ");
  });
});

describe("parseDelimited", () => {
  it("keeps quoted delimiters inside the cell", () => {
    const table = parseDelimited(csv);
    expect(table.headers).toEqual(["Code", "Course", "Credits", "Grade"]);
    expect(table.rows[0][1]).toBe("Operating Systems, advanced");
    expect(table.rows).toHaveLength(2);
  });

  it("pads short rows so columns stay aligned", () => {
    const table = parseDelimited("a,b,c\n1,2");
    expect(table.rows[0]).toEqual(["1", "2", ""]);
  });

  it("returns nothing for empty text", () => {
    expect(parseDelimited("   ")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseHtmlTable", () => {
  it("reads a portal grades table without touching the live DOM", () => {
    const html = `
      <html><body>
        <table><tr><td>layout</td></tr></table>
        <table>
          <tr><th>מספר קורס</th><th>שם הקורס</th><th>נק"ז</th><th>ציון</th></tr>
          <tr><td>62350</td><td>Operating Systems</td><td>4</td><td>86</td></tr>
          <tr><td>65010</td><td>Technical English</td><td>3</td><td>פטור</td></tr>
        </table>
      </body></html>`;
    const table = parseHtmlTable(html);
    expect(table.headers).toHaveLength(4);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][3]).toBe("פטור");
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("parseImportText", () => {
  it("picks the HTML adapter for markup and the delimited one for text", () => {
    expect(parseImportText("<table><tr><th>a</th></tr><tr><td>1</td></tr></table>").adapter.id)
      .toBe("html-table");
    expect(parseImportText(csv).adapter.id).toBe("delimited");
  });

  it("pre-fills the column mapping from the headers", () => {
    const parsed = parseImportText(csv);
    expect(parsed.mapping).toEqual(["code", "name", "credits", "grade"]);
  });

  it("turns the table into rows ready to import", () => {
    const parsed = parseImportText(csv);
    const rows = rowsFromTable(parsed.table, parsed.mapping, 60);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "62350", credits: 4, grade: 86, status: "COMPLETED" });
    expect(rows[1]).toMatchObject({ code: "61230", grade: 54, status: "FAILED" });
  });

  it("handles a Hebrew tab-separated paste", () => {
    const pasted = 'מספר קורס\tשם הקורס\tנק"ז\tציון\n62350\tמערכות הפעלה\t4\t86';
    const parsed = parseImportText(pasted);
    const rows = rowsFromTable(parsed.table, parsed.mapping, 60);
    expect(rows[0]).toMatchObject({ code: "62350", name: "מערכות הפעלה", credits: 4, grade: 86 });
  });
});
