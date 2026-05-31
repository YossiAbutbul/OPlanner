import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  addCourse,
  deleteYear,
  getAllYearsAndSemesters,
  initializeYear,
  setCourseColor,
  setCourseFinalDate,
  setCourseOrder,
  setSemesterColor,
  setYearColor,
} from "../utility/initializeDatabase";
import { lsCache } from "./useLocalStorageCache";
import type { YearTreeData } from "../types/models";

const yearsCacheKey = (uid: string) => `oplanner.years.${uid}`;
const bootstrappedKey = (uid: string) => `oplanner.bootstrapped.${uid}`;
const homeworkCacheKey = (uid: string, year: number, sem: string, course: string) =>
  `oplanner.homework.${uid}.${year}|${sem}|${course}`;

// Owns the year/semester/course tree: fetch, cache, mutate (colors, finals,
// reorder, add/delete year). Optimistic local update + Firestore write,
// rollback on failure.
export function useYearTree(
  user: User | null,
  bustHomeworkCache: (year: number, semester: string, course: string) => Promise<void>
) {
  const [years, setYears] = useState<YearTreeData[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [addingYear, setAddingYear] = useState(false);

  const persistYears = useCallback((next: YearTreeData[]) => {
    if (user) lsCache.write(yearsCacheKey(user.uid), next);
  }, [user]);

  const refreshYears = useCallback(async () => {
    if (!user) return;
    setYearsLoading(true);
    try {
      const data = await getAllYearsAndSemesters();
      setYears(data);
      persistYears(data);
    } finally {
      setYearsLoading(false);
    }
  }, [user, persistYears]);

  // Initial paint from cache + fresh pull
  useEffect(() => {
    if (!user) {
      setYears([]);
      return;
    }
    const cached = lsCache.read<YearTreeData[]>(yearsCacheKey(user.uid));
    if (Array.isArray(cached) && cached.length) {
      setYears(cached);
      setYearsLoading(false);
    }
    refreshYears();
  }, [user, refreshYears]);

  // Bootstrap: brand-new account with zero years gets the current calendar
  // year auto-created so the overview is immediately useful. One-shot per
  // user — if they delete the year later we don't recreate it.
  useEffect(() => {
    if (!user || yearsLoading) return;
    if (years.length > 0) return;
    const flag = bootstrappedKey(user.uid);
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");
    (async () => {
      let yearToAdd = new Date().getFullYear();
      while (true) {
        const added = await initializeYear(yearToAdd);
        if (added) break;
        yearToAdd += 1;
      }
      await addCourse(yearToAdd, "Semester A", "Course 1");
      await refreshYears();
    })();
  }, [user, years, yearsLoading, refreshYears]);

  const handleReorderCourses = useCallback(
    (year: number, semester: string, names: string[]) => {
      setYears((prev) => {
        const next = prev.map((y) => {
          if (y.year !== year) return y;
          return {
            ...y,
            semesters: y.semesters.map((s) => {
              if (s.name !== semester) return s;
              const byName = new Map(s.courses.map((c) => [c.name, c]));
              const ordered = names
                .filter((n) => byName.has(n))
                .map((n) => byName.get(n)!);
              return { ...s, courses: ordered };
            }),
          };
        });
        persistYears(next);
        return next;
      });
      void setCourseOrder(year, semester, names);
    },
    [persistYears]
  );

  const handleUpdateYearColor = useCallback(
    async (year: number, color: string | null) => {
      let prev: YearTreeData[] = [];
      setYears((curr) => {
        prev = curr;
        const next = curr.map((y) =>
          y.year === year ? { ...y, color: color ?? undefined } : y
        );
        persistYears(next);
        return next;
      });
      const ok = await setYearColor(year, color);
      if (!ok) {
        setYears(prev);
        persistYears(prev);
        throw new Error("Failed to save year color. Check your connection and try again.");
      }
    },
    [persistYears]
  );

  const handleUpdateSemesterColor = useCallback(
    async (year: number, semesterKey: string, color: string | null) => {
      let prev: YearTreeData[] = [];
      setYears((curr) => {
        prev = curr;
        const next = curr.map((y) => {
          if (y.year !== year) return y;
          return {
            ...y,
            semesters: y.semesters.map((s) =>
              s.key === semesterKey ? { ...s, color: color ?? undefined } : s
            ),
          };
        });
        persistYears(next);
        return next;
      });
      const ok = await setSemesterColor(year, semesterKey, color);
      if (!ok) {
        setYears(prev);
        persistYears(prev);
        throw new Error("Failed to save semester color. Check your connection and try again.");
      }
    },
    [persistYears]
  );

  const handleUpdateCourseColor = useCallback(
    async (year: number, semesterKey: string, course: string, color: string | null) => {
      let prev: YearTreeData[] = [];
      setYears((curr) => {
        prev = curr;
        const next = curr.map((y) => {
          if (y.year !== year) return y;
          return {
            ...y,
            semesters: y.semesters.map((s) => {
              if (s.key !== semesterKey) return s;
              return {
                ...s,
                courses: s.courses.map((c) =>
                  c.name === course ? { ...c, color: color ?? undefined } : c
                ),
              };
            }),
          };
        });
        persistYears(next);
        return next;
      });
      const ok = await setCourseColor(year, semesterKey, course, color);
      if (!ok) {
        setYears(prev);
        persistYears(prev);
        throw new Error("Failed to save course color. Check your connection and try again.");
      }
    },
    [persistYears]
  );

  const handleUpdateCourseFinalDate = useCallback(
    async (year: number, semesterKey: string, course: string, date: string | null) => {
      let prev: YearTreeData[] = [];
      setYears((curr) => {
        prev = curr;
        const next = curr.map((y) => {
          if (y.year !== year) return y;
          return {
            ...y,
            semesters: y.semesters.map((s) => {
              if (s.key !== semesterKey) return s;
              return {
                ...s,
                courses: s.courses.map((c) =>
                  c.name === course ? { ...c, finalDate: date ?? undefined } : c
                ),
              };
            }),
          };
        });
        persistYears(next);
        return next;
      });
      const ok = await setCourseFinalDate(year, semesterKey, course, date);
      if (!ok) {
        setYears(prev);
        persistYears(prev);
        throw new Error("Failed to save final date. Check your connection and try again.");
      }
      // Bust homework cache so next read pulls the updated/created/deleted final task.
      if (user) lsCache.remove(homeworkCacheKey(user.uid, year, semesterKey, course));
      await bustHomeworkCache(year, semesterKey, course);
    },
    [persistYears, user, bustHomeworkCache]
  );

  const handleDeleteYear = useCallback(
    async (year: number): Promise<boolean> => {
      const ok = await deleteYear(year);
      if (!ok) return false;
      await refreshYears();
      return true;
    },
    [refreshYears]
  );

  const handleAddYear = useCallback(async () => {
    setAddingYear(true);
    try {
      let yearToAdd = new Date().getFullYear();
      while (true) {
        const added = await initializeYear(yearToAdd);
        if (added) break;
        yearToAdd += 1;
      }
      await refreshYears();
    } finally {
      setAddingYear(false);
    }
  }, [refreshYears]);

  return {
    years,
    yearsLoading,
    addingYear,
    refreshYears,
    handleReorderCourses,
    handleUpdateYearColor,
    handleUpdateSemesterColor,
    handleUpdateCourseColor,
    handleUpdateCourseFinalDate,
    handleDeleteYear,
    handleAddYear,
  };
}
