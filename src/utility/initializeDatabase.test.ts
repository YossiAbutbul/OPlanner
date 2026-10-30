import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDoc, writeBatch, batch } = vi.hoisted(() => {
  const batch = { set: vi.fn(), commit: vi.fn() };
  return { getDoc: vi.fn(), writeBatch: vi.fn(() => batch), batch };
});

vi.mock("../firebase", () => ({ db: {}, auth: {}, requireUid: () => "u1" }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  collection: vi.fn(),
  getDoc,
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch,
  query: vi.fn(),
  limit: vi.fn(),
}));

import { setDoc } from "firebase/firestore";
import { addCourse, initializeYear } from "./initializeDatabase";

describe("initializeYear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batch.commit.mockResolvedValue(undefined);
    getDoc.mockResolvedValue({ exists: () => false });
  });

  it("writes the year, its semesters and a first course in one batch", async () => {
    await expect(initializeYear(2026, { starterCourse: "Course 1" })).resolves.toBe("created");
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls.map(([ref]) => ref.path)).toEqual([
      "users/u1/years/2026",
      "users/u1/years/2026/semesters/Semester A",
      "users/u1/years/2026/semesters/Semester B",
      "users/u1/years/2026/semesters/Semester C",
      "users/u1/years/2026/semesters/Semester A/courses/Course 1",
    ]);
  });

  it("reports an existing year without writing", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await expect(initializeYear(2026)).resolves.toBe("exists");
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("reports a failed write as failed, not as an existing year", async () => {
    batch.commit.mockRejectedValueOnce(new Error("Missing or insufficient permissions."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(initializeYear(2026)).resolves.toBe("failed");
  });
});

describe("addCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a course that isn't there yet", async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => true }) // the semester
      .mockResolvedValueOnce({ exists: () => false }); // the course
    await expect(addCourse(2027, "Semester A", "Algorithms")).resolves.toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  // A calendar re-import calls addCourse for every course in the file. It
  // used to overwrite the doc and wipe the course's links, notes and grades.
  it("leaves an existing course untouched", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await expect(addCourse(2027, "Semester A", "Algorithms")).resolves.toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
