import { describe, expect, it } from "vitest";
import { isPdf, linesFromItems } from "./pdf";

// Fragments as pdf.js hands them over: positioned pieces, not lines.
const item = (str: string, x: number, y: number, width = str.length * 5) => ({
  str,
  x,
  y,
  width,
});

describe("linesFromItems", () => {
  it("groups fragments on the same baseline into one line, top down", () => {
    const lines = linesFromItems([
      item("second line", 10, 80),
      item("first line", 10, 100),
    ]);
    expect(lines).toEqual(["first line", "second line"]);
  });

  it("reads a Hebrew line right to left", () => {
    // Visually: "20109 - אלגברה לינארית 1" with the code on the right.
    const lines = linesFromItems([
      item("1", 466, 446, 6),
      item("- אלגברה לינארית", 474, 446, 68),
      item("20109", 546, 446, 30),
    ]);
    expect(lines).toEqual(["20109 - אלגברה לינארית 1"]);
  });

  it("keeps an English line left to right", () => {
    const lines = linesFromItems([
      item("Operating", 10, 50, 50),
      item("Systems", 62, 50, 45),
    ]);
    expect(lines).toEqual(["Operating Systems"]);
  });

  it("puts a space back where the geometry shows a gap, not inside a word", () => {
    const split = linesFromItems([item("Opera", 10, 50, 25), item("ting", 35, 50, 20)]);
    expect(split).toEqual(["Operating"]);

    const spaced = linesFromItems([item("Code", 10, 50, 25), item("Grade", 60, 50, 30)]);
    expect(spaced).toEqual(["Code Grade"]);
  });

  it("tolerates a baseline that wobbles by a point or two", () => {
    const lines = linesFromItems([item("סטטוס:", 500, 300, 30), item("הצלחה", 460, 302, 35)]);
    expect(lines).toEqual(["סטטוס: הצלחה"]);
  });

  it("drops empty fragments and blank lines", () => {
    expect(linesFromItems([item("", 10, 50, 0), item("   ", 20, 50, 5)])).toEqual([]);
  });
});

describe("isPdf", () => {
  it("recognizes a PDF by type or by extension", () => {
    expect(isPdf(new File([""], "plan.pdf", { type: "application/pdf" }))).toBe(true);
    expect(isPdf(new File([""], "PLAN.PDF"))).toBe(true);
    expect(isPdf(new File([""], "grades.csv", { type: "text/csv" }))).toBe(false);
  });
});
