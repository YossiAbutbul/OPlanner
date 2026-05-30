import { describe, expect, it } from "vitest";
import { courseColor, defaultCourseColor } from "./courseColor";

describe("courseColor", () => {
  it("returns the explicit color if provided", () => {
    expect(courseColor("anything", "#abcdef")).toBe("#abcdef");
  });

  it("falls back to deterministic default when explicit is empty/null", () => {
    expect(courseColor("data structures", null)).toBe(
      defaultCourseColor("data structures")
    );
    expect(courseColor("data structures", "")).toBe(
      defaultCourseColor("data structures")
    );
    expect(courseColor("data structures", undefined)).toBe(
      defaultCourseColor("data structures")
    );
  });

  it("default color is stable for the same name", () => {
    const a = defaultCourseColor("Calculus");
    const b = defaultCourseColor("Calculus");
    expect(a).toBe(b);
  });

  it("default color is case-insensitive", () => {
    expect(defaultCourseColor("Calculus")).toBe(defaultCourseColor("CALCULUS"));
    expect(defaultCourseColor("Calculus")).toBe(defaultCourseColor("calculus"));
  });

  it("returns a value from the palette (hex format)", () => {
    expect(defaultCourseColor("any name")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("different names usually map to different colors (smoke)", () => {
    const colors = new Set([
      defaultCourseColor("a"),
      defaultCourseColor("b"),
      defaultCourseColor("c"),
      defaultCourseColor("d"),
      defaultCourseColor("e"),
    ]);
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });
});
