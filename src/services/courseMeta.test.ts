import { describe, expect, it } from "vitest";
import {
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
      credits: 3,
    });
    expect(meta).toEqual({});
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
