import { describe, expect, it } from "vitest";
import { WAITLIST_EMAILS_PER_DAY, cleanName, takeEmailSlot, waitlistEmail } from "./waitlist";

const NOON = Date.parse("2026-10-27T12:00:00Z");

describe("waitlist", () => {
  it("emails until the daily cap, then only saves", () => {
    expect(takeEmailSlot(undefined, NOON)).toEqual({ notify: true, next: { day: "2026-10-27", count: 1 } });
    const full = { day: "2026-10-27", count: WAITLIST_EMAILS_PER_DAY };
    expect(takeEmailSlot(full, NOON).notify).toBe(false);
  });

  it("resets the cap on a new UTC day", () => {
    const yesterday = { day: "2026-10-26", count: WAITLIST_EMAILS_PER_DAY };
    expect(takeEmailSlot(yesterday, NOON)).toEqual({ notify: true, next: { day: "2026-10-27", count: 1 } });
  });

  it("keeps display names to one short line", () => {
    expect(cleanName("Dana\r\nBcc: x@y.z")).toBe("Dana  Bcc: x@y.z");
    expect(cleanName("x".repeat(300))).toHaveLength(100);
    expect(cleanName(undefined)).toBe("");
  });

  it("writes the owner a plain email with what to do next", () => {
    const m = waitlistEmail({ email: "a@b.co", name: "Dana", verified: false });
    expect(m.subject).toContain("a@b.co");
    expect(m.text).toContain("Dana asked to join");
    expect(m.text).toContain("(not verified)");
    expect(m.text).toContain("AGENT_ALLOWED_EMAILS");
  });
});
