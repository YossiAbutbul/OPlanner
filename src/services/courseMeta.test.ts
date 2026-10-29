import { describe, expect, it, vi } from "vitest";

// courseMeta imports ../firebase (db), which runs getAuth() at module load.
// CI has no VITE_FIREBASE_* env, so that throws auth/invalid-api-key. Mock it
// out — these tests only exercise the pure helpers, no Firestore calls.
vi.mock("../firebase", () => ({ db: {}, auth: {}, requireUid: () => "test-uid" }));

import {
  MAX_GRADE_ITEMS,
  MAX_LINKS,
  isValidLinkUrl,
  linkIconType,
  normalizeCourseMeta,
} from "./courseMeta";

describe("isValidLinkUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidLinkUrl("https://moodle.example.ac.il/course/1")).toBe(true);
    expect(isValidLinkUrl("http://example.com")).toBe(true);
  });

  it("rejects javascript:, data:, ftp: and garbage", () => {
    expect(isValidLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isValidLinkUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isValidLinkUrl("ftp://example.com/file")).toBe(false);
    expect(isValidLinkUrl("not a url")).toBe(false);
    expect(isValidLinkUrl("")).toBe(false);
    expect(isValidLinkUrl("http://")).toBe(false);
  });

  it("rejects absurdly long URLs", () => {
    expect(isValidLinkUrl("https://example.com/" + "a".repeat(3000))).toBe(false);
  });
});

describe("linkIconType", () => {
  it("maps known hosts", () => {
    expect(linkIconType("https://moodle.tau.ac.il/course")).toBe("moodle");
    expect(linkIconType("https://us02web.zoom.us/j/123")).toBe("zoom");
    expect(linkIconType("https://drive.google.com/drive/folders/x")).toBe("drive");
    expect(linkIconType("https://github.com/user/repo")).toBe("github");
    expect(linkIconType("https://www.youtube.com/watch?v=x")).toBe("youtube");
    expect(linkIconType("https://youtu.be/x")).toBe("youtube");
    expect(linkIconType("https://docs.google.com/document/d/x")).toBe("docs");
    expect(linkIconType("https://www.notion.so/page")).toBe("docs");
  });

  it("falls back to generic", () => {
    expect(linkIconType("https://example.com")).toBe("generic");
    expect(linkIconType("garbage")).toBe("generic");
  });
});

describe("normalizeCourseMeta", () => {
  it("returns {} for legacy docs and bad input", () => {
    expect(normalizeCourseMeta(undefined)).toEqual({});
    expect(normalizeCourseMeta(null)).toEqual({});
    expect(normalizeCourseMeta({ color: "#fff", finalDate: "2026-07-01" })).toEqual({});
  });

  it("ignores removed structured fields", () => {
    const meta = normalizeCourseMeta({
      instructorName: "Dr. Cohen",
      instructorEmail: "cohen@uni.ac.il",
      room: "B34/103",
    });
    expect(meta).toEqual({});
  });

  // credits was one of those removed fields and is read again now that the
  // GPA needs it, so a course doc still carrying one keeps it.
  it("reads credits left over from the old course info form", () => {
    expect(normalizeCourseMeta({ room: "B34/103", credits: 3 })).toEqual({ credits: 3 });
  });

  it("keeps valid links and drops malformed ones", () => {
    const meta = normalizeCourseMeta({
      links: [
        { id: "a", label: "Moodle", url: "https://moodle.example.com" },
        { id: "b", label: "Evil", url: "javascript:alert(1)" },
        { id: "c", label: 5, url: "https://ok.com" },
        "not-an-object",
        { id: "d", label: "Zoom", url: "https://zoom.us/j/1" },
      ],
    });
    expect(meta.links?.map((l) => l.id)).toEqual(["a", "d"]);
  });

  it("caps links at MAX_LINKS", () => {
    const links = Array.from({ length: MAX_LINKS + 5 }, (_, i) => ({
      id: String(i),
      label: `L${i}`,
      url: "https://example.com",
    }));
    expect(normalizeCourseMeta({ links }).links).toHaveLength(MAX_LINKS);
  });

  it("keeps notes", () => {
    expect(normalizeCourseMeta({ courseNotes: "<b>hi</b>" })).toEqual({
      courseNotes: "<b>hi</b>",
    });
  });

  it("drops oversized or non-string notes", () => {
    expect(normalizeCourseMeta({ courseNotes: "x".repeat(50001) }).courseNotes).toBeUndefined();
    expect(normalizeCourseMeta({ courseNotes: 42 }).courseNotes).toBeUndefined();
  });
});

describe("normalizeCourseMeta — grades", () => {
  it("keeps a well-formed sheet", () => {
    const meta = normalizeCourseMeta({
      gradeItems: [
        { id: "a", label: "ממן 11", weight: 10, score: 92 },
        { id: "b", label: "Final", weight: 90 },
      ],
      credits: 4,
    });
    expect(meta.gradeItems).toEqual([
      { id: "a", label: "ממן 11", weight: 10, score: 92 },
      { id: "b", label: "Final", weight: 90 },
    ]);
    expect(meta.credits).toBe(4);
  });

  it("drops rows without a string id or label", () => {
    const meta = normalizeCourseMeta({
      gradeItems: [{ id: 7, label: "x", weight: 10 }, { id: "ok", label: "Quiz", weight: 10 }],
    });
    expect(meta.gradeItems).toHaveLength(1);
    expect(meta.gradeItems?.[0].label).toBe("Quiz");
  });

  it("zeroes a weight outside 0–100 and forgets an impossible score", () => {
    const meta = normalizeCourseMeta({
      gradeItems: [{ id: "a", label: "Quiz", weight: 400, score: 900 }],
    });
    expect(meta.gradeItems?.[0].weight).toBe(0);
    expect(meta.gradeItems?.[0].score).toBeUndefined();
  });

  it("keeps a zero score, which is a real mark", () => {
    const meta = normalizeCourseMeta({
      gradeItems: [{ id: "a", label: "Quiz", weight: 10, score: 0 }],
    });
    expect(meta.gradeItems?.[0].score).toBe(0);
  });

  // A cleared sheet has to survive the round trip, or the panel refills it
  // from the default on the next visit.
  it("keeps an empty sheet empty, and tells it from no sheet at all", () => {
    expect(normalizeCourseMeta({ gradeItems: [] }).gradeItems).toEqual([]);
    expect(normalizeCourseMeta({}).gradeItems).toBeUndefined();
    expect(normalizeCourseMeta({ gradeItems: "nonsense" }).gradeItems).toBeUndefined();
  });

  it("keeps the list of dismissed assignments, deduplicated", () => {
    expect(normalizeCourseMeta({ gradeSkips: ["#1", "#1", "participation"] }).gradeSkips).toEqual([
      "#1",
      "participation",
    ]);
    expect(normalizeCourseMeta({ gradeSkips: [1, null, ""] }).gradeSkips).toBeUndefined();
    expect(normalizeCourseMeta({}).gradeSkips).toBeUndefined();
  });

  it("caps the sheet length", () => {
    const many = Array.from({ length: MAX_GRADE_ITEMS + 5 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
      weight: 1,
    }));
    expect(normalizeCourseMeta({ gradeItems: many }).gradeItems).toHaveLength(MAX_GRADE_ITEMS);
  });

  it("ignores credits that are not finite numbers in range", () => {
    expect(normalizeCourseMeta({ credits: "4" }).credits).toBeUndefined();
    expect(normalizeCourseMeta({ credits: NaN }).credits).toBeUndefined();
    expect(normalizeCourseMeta({ credits: -1 }).credits).toBeUndefined();
    expect(normalizeCourseMeta({ credits: 99 }).credits).toBeUndefined();
  });

  it("leaves a legacy course doc with no grade fields alone", () => {
    const meta = normalizeCourseMeta({ courseNotes: "<p>hi</p>" });
    expect(meta.gradeItems).toBeUndefined();
    expect(meta.credits).toBeUndefined();
  });
});
