import { describe, expect, it, vi } from "vitest";
import { REAUTH_MAX_AGE_SEC, chunk, deleteUserData, signedInRecently, uidsWithData } from "./userData";
import type { Firestore } from "firebase-admin/firestore";

describe("user data", () => {
  it("requires a sign-in from the last few minutes", () => {
    const now = Date.parse("2026-10-27T12:00:00Z");
    expect(signedInRecently(now / 1000 - 60, now)).toBe(true);
    expect(signedInRecently(now / 1000 - REAUTH_MAX_AGE_SEC - 1, now)).toBe(false);
  });

  it("splits ids into groups for getUsers", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });

  it("deletes the user's tree and their server-only docs", async () => {
    const deleted: string[] = [];
    const db = {
      doc: (path: string) => ({ path, delete: async () => void deleted.push(path) }),
      recursiveDelete: vi.fn(async (ref: { path: string }) => void deleted.push(`${ref.path}/**`)),
    } as unknown as Firestore;
    await deleteUserData(db, "u1");
    expect(deleted.sort()).toEqual(["agentUsage/u1", "agentWaitlist/u1", "users/u1/**"]);
  });

  it("collects every uid that has data, once", async () => {
    const ids: Record<string, string[]> = { users: ["b", "a"], agentUsage: ["a", "c"], agentWaitlist: [] };
    const db = {
      collection: (c: string) => ({ listDocuments: async () => ids[c].map((id) => ({ id })) }),
    } as unknown as Firestore;
    expect(await uidsWithData(db)).toEqual(["a", "b", "c"]);
  });
});
