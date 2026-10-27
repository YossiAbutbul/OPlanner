import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { lsCache } from "./useLocalStorageCache";
import type { YearTreeData } from "../types/models";

const lastSelectionKey = (uid: string) => `oplanner.lastSelection.${uid}`;
const lastSemesterByYearKey = (uid: string) => `oplanner.lastSemesterByYear.${uid}`;

// Heuristic by month — Israeli academic calendar.
const semesterForMonth = (month: number): string =>
  month >= 9 || month <= 1
    ? "Semester A"
    : month >= 2 && month <= 6
    ? "Semester B"
    : "Semester C";

// Picks the best default semester for a given year tree.
// Priority: per-year saved → heuristic by month → "Semester A" → first.
export function pickSemesterForYear(
  uid: string | null,
  yearTree: YearTreeData
): string | null {
  if (yearTree.semesters.length === 0) return null;
  if (uid) {
    const map = lsCache.read<Record<string, string>>(lastSemesterByYearKey(uid));
    const saved = map?.[String(yearTree.year)];
    if (saved && yearTree.semesters.some((s) => s.name === saved)) return saved;
  }
  const guess = semesterForMonth(new Date().getMonth());
  const match = yearTree.semesters.find((s) => s.name === guess);
  if (match) return match.name;
  const semA = yearTree.semesters.find((s) => s.name === "Semester A");
  if (semA) return semA.name;
  return yearTree.semesters[0]?.name ?? null;
}

// Saved per account; kept across sign-out (see AuthContext), since they
// hold only a year number and a semester name.
export const SELECTION_KEY_PREFIXES = ["oplanner.lastSelection.", "oplanner.lastSemesterByYear."];

// Owns selectedYear / selectedSemester / selectedCourse + persistence.
//
// Restoring: until the user picks something, the selection keeps moving to
// the saved year and semester as the tree updates. The first tree can be a
// cache that's missing them; when the fresh one has them, it switches.
// Saving: only the user's own picks are written, never a fallback guess, so
// a stale first load can't overwrite what they chose.
export function useSelection(user: User | null, years: YearTreeData[]) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourseState] = useState<string | null>(null);
  // Set once the user picks a year, semester or course themselves.
  const touched = useRef(false);

  useEffect(() => {
    touched.current = false;
  }, [user]);

  useEffect(() => {
    if (!user || years.length === 0 || touched.current) return;
    const last = lsCache.read<{ year?: number }>(lastSelectionKey(user.uid));
    const target =
      years.find((y) => y.year === last?.year) ??
      years.find((y) => y.year === selectedYear) ??
      years.find((y) => y.year === new Date().getFullYear()) ??
      years[years.length - 1];
    const semester = pickSemesterForYear(user.uid, target);
    if (target.year !== selectedYear) setSelectedYear(target.year);
    if (semester !== selectedSemester) setSelectedSemester(semester);
  }, [years, user, selectedYear, selectedSemester]);

  const saveYear = useCallback(
    (y: number) => {
      if (user) lsCache.write(lastSelectionKey(user.uid), { year: y });
    },
    [user]
  );

  const saveSemester = useCallback(
    (y: number, s: string) => {
      if (!user) return;
      const key = lastSemesterByYearKey(user.uid);
      const map = lsCache.read<Record<string, string>>(key) ?? {};
      map[String(y)] = s;
      lsCache.write(key, map);
    },
    [user]
  );

  // Selecting a year auto-picks its preferred semester and clears the course.
  const selectYear = useCallback(
    (y: number) => {
      touched.current = true;
      if (y === selectedYear) return;
      setSelectedYear(y);
      saveYear(y);
      const yearTree = years.find((yy) => yy.year === y);
      setSelectedSemester(yearTree ? pickSemesterForYear(user?.uid ?? null, yearTree) : null);
      setSelectedCourseState(null);
    },
    [selectedYear, years, user, saveYear]
  );

  const selectSemester = useCallback(
    (s: string) => {
      touched.current = true;
      if (selectedYear !== null) {
        saveYear(selectedYear);
        saveSemester(selectedYear, s);
      }
      if (s === selectedSemester) return;
      setSelectedSemester(s);
      setSelectedCourseState(null);
    },
    [selectedSemester, selectedYear, saveYear, saveSemester]
  );

  // Opening a course counts as the user's choice too: the selection stops
  // following the saved one, so it can't jump away from what they opened.
  const setSelectedCourse = useCallback((c: string | null) => {
    if (c !== null) touched.current = true;
    setSelectedCourseState(c);
  }, []);

  return {
    selectedYear,
    selectedSemester,
    selectedCourse,
    setSelectedYear,
    setSelectedSemester,
    setSelectedCourse,
    selectYear,
    selectSemester,
  };
}
