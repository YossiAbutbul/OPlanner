import { describe, expect, it } from "vitest";
import { detectOpenU, openUMeta, parseOpenU } from "./openu";
import { parseImportText, rowsFromTable } from "./index";

// Verbatim text from an Open University "תכניות לימודים אישיות" printout,
// page furniture and page breaks included.
const SAMPLE = `נקודות זכות בתכנית : 121
תכניות לימודים אישיות 23.8.2026 , 21:59
שם: יוסי אבוטבול
תכנית הלימודים בוגר B.Sc. במדעי המחשב ). B.Sc (
קורס נ"ז סטטוס
20109 - אלגברה לינארית 1 7 סטטוס: הצלחה
רמה: רגיל
סמסטר: 2023 א
נכלל? כן
20375 - סמינר בנושא מיוחד במדעי המחשב 3 סטטוס: בלימוד
רמה: מתקדם סמינריוני
סמסטר: 2026 ג
6 / 1 https://sheilta.apps.openu.ac.il/Main/StudyPrograms#/final

תכניות לימודים אישיות 23.8.2026 , 21:59
נכלל? כן
6 / 2 https://sheilta.apps.openu.ac.il/Main/StudyPrograms#/final
20425 - הסתברות ומבוא לסטטיסטיקה למדעי המחשב 5 סטטוס:
רמה: רגיל
סמסטר:
נכלל? כן
22928 - מבוא לראייה ממוחשבת סטטוס: בלימוד
רמה: תואר שני
סמסטר: 2027 א
נכלל? לא
סיכום נקודות זכות
פתיחה רגיל מתקדם סה"כ
0 89 32 121`;

describe("detectOpenU", () => {
  it("recognizes the study program page", () => {
    expect(detectOpenU(SAMPLE)).toBeGreaterThan(0.9);
  });

  it("stays out of the way of a plain CSV", () => {
    expect(detectOpenU("Code,Course,Credits\n62350,OS,4")).toBe(0);
  });
});

describe("parseOpenU", () => {
  const table = parseOpenU(SAMPLE);

  it("finds every course and drops the page furniture", () => {
    expect(table.rows).toHaveLength(4);
    expect(table.rows.map((r) => r[0])).toEqual(["20109", "20375", "20425", "22928"]);
  });

  it("splits the trailing credit count off the course name", () => {
    expect(table.rows[0][1]).toBe("אלגברה לינארית 1");
    expect(table.rows[0][2]).toBe("7");
  });

  it("keeps a course that carries no credits", () => {
    expect(table.rows[3][1]).toBe("מבוא לראייה ממוחשבת");
    expect(table.rows[3][2]).toBe("");
  });

  it("reads the status, level, term and inclusion of each course", () => {
    expect(table.rows[0].slice(3)).toEqual(["הצלחה", "רגיל", "2023 א", "כן"]);
    expect(table.rows[1].slice(3)).toEqual(["בלימוד", "מתקדם סמינריוני", "2026 ג", "כן"]);
    // No status and no term yet: a course in the plan but not taken.
    expect(table.rows[2].slice(3)).toEqual(["", "רגיל", "", "כן"]);
    expect(table.rows[3][6]).toBe("לא");
  });

  it("reads the program credit total", () => {
    expect(openUMeta(SAMPLE)).toEqual({ programCredits: 121 });
  });
});

describe("open university import end to end", () => {
  const parsed = parseImportText(SAMPLE);

  it("picks the Open University adapter and maps every column", () => {
    expect(parsed.adapter.id).toBe("openu");
    expect(parsed.mapping).toEqual([
      "code",
      "name",
      "credits",
      "status",
      "group",
      "term",
      "counts",
    ]);
    expect(parsed.meta.programCredits).toBe(121);
  });

  it("turns Hebrew statuses and terms into plan courses", () => {
    const rows = rowsFromTable(parsed.table, parsed.mapping, 60);
    expect(rows[0]).toMatchObject({
      code: "20109",
      name: "אלגברה לינארית 1",
      credits: 7,
      status: "COMPLETED",
      year: 2023,
      semester: "Semester A",
      group: "רגיל",
    });
    expect(rows[1]).toMatchObject({ status: "IN_PROGRESS", semester: "Semester C", year: 2026 });
    // No status word at all means the course is still only planned.
    expect(rows[2].status).toBe("PLANNED");
    expect(rows[2].year).toBeUndefined();
    // נכלל? לא — in the plan but not counted toward the degree.
    expect(rows[3].countsToward).toBe(false);
  });
});
