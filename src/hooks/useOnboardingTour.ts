import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { addCourse } from "../utility/initializeDatabase";
import type { YearTreeData } from "../types/models";

const tourDoneKey = (uid: string) => `oplanner.tour.done.${uid}`;

// Drives the one-shot onboarding tour. Auto-starts when a fresh semester has
// at least one course (creating a placeholder course if needed). `replayTour`
// resets the per-user flag and starts the tour again.
export function useOnboardingTour(args: {
  user: User | null;
  years: YearTreeData[];
  yearsLoading: boolean;
  selectedYear: number | null;
  selectedSemester: string | null;
  refreshYears: () => Promise<void>;
}) {
  const { user, years, yearsLoading, selectedYear, selectedSemester, refreshYears } = args;
  const [tourRun, setTourRun] = useState(false);
  const tourKey = user ? tourDoneKey(user.uid) : null;

  const finishTour = useCallback(() => {
    if (tourKey) localStorage.setItem(tourKey, "1");
    setTourRun(false);
  }, [tourKey]);

  const ensureSampleCourse = useCallback(async () => {
    const sem = years
      .find((y) => y.year === selectedYear)
      ?.semesters.find((s) => s.name === selectedSemester);
    if (sem && sem.courses.length === 0 && selectedYear && selectedSemester) {
      await addCourse(selectedYear, selectedSemester, "Course 1");
      await refreshYears();
    }
  }, [years, selectedYear, selectedSemester, refreshYears]);

  const replayTour = useCallback(async () => {
    if (tourKey) localStorage.removeItem(tourKey);
    await ensureSampleCourse();
    setTourRun(true);
  }, [tourKey, ensureSampleCourse]);

  useEffect(() => {
    if (!tourKey || yearsLoading) return;
    if (localStorage.getItem(tourKey)) return;
    const sem = years
      .find((y) => y.year === selectedYear)
      ?.semesters.find((s) => s.name === selectedSemester);
    if (sem && sem.courses.length === 0 && selectedYear && selectedSemester) {
      (async () => {
        await addCourse(selectedYear, selectedSemester, "Course 1");
        await refreshYears();
      })();
      return;
    }
    if (!sem || sem.courses.length === 0) return;
    const t = setTimeout(() => setTourRun(true), 600);
    return () => clearTimeout(t);
  }, [tourKey, yearsLoading, years, selectedYear, selectedSemester, refreshYears]);

  return { tourRun, finishTour, replayTour };
}
