import { useCallback, useEffect, useState } from "react";
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

// Owns selectedYear / selectedSemester / selectedCourse + persistence.
export function useSelection(user: User | null, years: YearTreeData[]) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // First-time selection when years load.
  useEffect(() => {
    if (selectedYear !== null || years.length === 0 || !user) return;
    let yearToOpen: YearTreeData | null = null;
    const last = lsCache.read<{ year?: number }>(lastSelectionKey(user.uid));
    if (last?.year !== undefined) {
      const match = years.find((y) => y.year === last.year);
      if (match) yearToOpen = match;
    }
    if (!yearToOpen) {
      const guess = new Date().getFullYear();
      yearToOpen = years.find((y) => y.year === guess) || years[years.length - 1];
    }
    if (!yearToOpen) return;
    setSelectedYear(yearToOpen.year);
    setSelectedSemester(pickSemesterForYear(user.uid, yearToOpen));
  }, [years, selectedYear, user]);

  // Persist last selection.
  useEffect(() => {
    if (!user || selectedYear === null) return;
    lsCache.write(lastSelectionKey(user.uid), { year: selectedYear });
    if (selectedSemester) {
      const key = lastSemesterByYearKey(user.uid);
      const map = lsCache.read<Record<string, string>>(key) ?? {};
      map[String(selectedYear)] = selectedSemester;
      lsCache.write(key, map);
    }
  }, [user, selectedYear, selectedSemester]);

  // Selecting a year auto-picks its preferred semester and clears the course.
  const selectYear = useCallback(
    (y: number) => {
      if (y === selectedYear) return;
      setSelectedYear(y);
      const yearTree = years.find((yy) => yy.year === y);
      setSelectedSemester(yearTree ? pickSemesterForYear(user?.uid ?? null, yearTree) : null);
      setSelectedCourse(null);
    },
    [selectedYear, years, user]
  );

  const selectSemester = useCallback(
    (s: string) => {
      if (s === selectedSemester) return;
      setSelectedSemester(s);
      setSelectedCourse(null);
    },
    [selectedSemester]
  );

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
