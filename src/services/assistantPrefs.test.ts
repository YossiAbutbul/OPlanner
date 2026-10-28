import { describe, expect, it, vi } from "vitest";

vi.mock("../firebase", () => ({ db: {} }));
const { mergeHidden } = await import("./assistantPrefs");

describe("mergeHidden", () => {
  it("keeps everything either device put away, the longest wins", () => {
    expect(
      mergeHidden(
        { a: "2026-10-29", b: "forever", c: "2026-10-30" },
        { a: "forever", b: "2026-10-29", c: "2026-10-29", d: "2026-11-01" }
      )
    ).toEqual({ a: "forever", b: "forever", c: "2026-10-30", d: "2026-11-01" });
  });
});
