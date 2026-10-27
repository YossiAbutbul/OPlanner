import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  SEMESTER_NAMES,
  deleteYear,
  getAllYearsAndSemesters,
  hasNoYearsOnServer,
  initializeYear,
  pickYearColor,
  semesterDefaultColor,
  setCourseColor,
  setCourseFinalDate,
  setCourseOrder,
  setSemesterColor,
  setYearColor,
} from "../utility/initializeDatabase";
import { lsCache } from "./useLocalStorageCache";
import type { YearTreeData } from "../types/models";
import { FINAL_DATE_EVENT, type FinalDateDetail } from "../services/homework";

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

  // Set when the tree couldn't be read (permissions, offline). What's on
  // screen stays as it was, and the main view offers a retry.
  const [loadError, setLoadError] = useState(false);

  const refreshYears = useCallback(async () => {
    if (!user) return;
    setYearsLoading(true);
    try {
      const data = await getAllYearsAndSemesters();
      setYears(data);
      persistYears(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
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

  // Bootstrap: a brand-new account gets the current year, its semesters and
  // a first course so the overview is useful at once. The tree is shown
  // straight away and written in one batch behind it. Runs only when the
  // server confirms there are no years (a failed load or an empty offline
  // cache looks the same), and the flag is set only after it worked, so a
  // failed first try runs again next time. Once done it never re-runs, even
  // if the user later deletes the year.
  const [bootstrapping, setBootstrapping] = useState(false);
  const bootstrapStarted = useRef(false);
  useEffect(() => {
    if (!user || yearsLoading || loadError || years.length > 0 || bootstrapStarted.current) return;
    const flag = bootstrappedKey(user.uid);
    if (localStorage.getItem(flag)) return;
    bootstrapStarted.current = true;
    setBootstrapping(true);
    (async () => {
      try {
        if (!(await hasNoYearsOnServer())) {
          localStorage.setItem(flag, "1");
          await refreshYears();
          return;
        }
        const year = new Date().getFullYear();
        const color = pickYearColor();
        const starter: YearTreeData[] = [{
          year,
          color,
          semesters: SEMESTER_NAMES.map((name, i) => ({
            name,
            key: name,
            color: semesterDefaultColor(name),
            courses: i === 0 ? [{ name: "Course 1" }] : [],
          })),
        }];
        setYears(starter);
        const result = await initializeYear(year, { color, starterCourse: "Course 1" });
        if (result === "failed") {
          setYears([]);
          return;
        }
        persistYears(starter);
        localStorage.setItem(flag, "1");
        await refreshYears();
      } catch (e) {
        // Offline or the server didn't answer: try again on the next load.
        console.error("First-run setup failed:", e);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [user, years, yearsLoading, loadError, refreshYears, persistYears]);

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

  // The Final Exam task was edited somewhere (task dialog, table, sidebar):
  // mirror its date here so the Finals widget and reminders follow. The
  // homework context already writes the course document.
  useEffect(() => {
    const onFinal = (e: Event) => {
      const { year, semester, course, date } = (e as CustomEvent<FinalDateDetail>).detail;
      setYears((curr) => {
        const next = curr.map((y) =>
          y.year !== year
            ? y
            : {
                ...y,
                semesters: y.semesters.map((s) =>
                  s.key !== semester && s.name !== semester
                    ? s
                    : {
                        ...s,
                        courses: s.courses.map((c) =>
                          c.name === course ? { ...c, finalDate: date ?? undefined } : c
                        ),
                      }
                ),
              }
        );
        persistYears(next);
        return next;
      });
    };
    window.addEventListener(FINAL_DATE_EVENT, onFinal);
    return () => window.removeEventListener(FINAL_DATE_EVENT, onFinal);
  }, [persistYears]);

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
      // Next year that doesn't exist yet; stop on a failed write instead of
      // trying ever later years.
      const start = new Date().getFullYear();
      for (let y = start; y < start + 50; y++) {
        const result = await initializeYear(y);
        if (result !== "exists") break;
      }
      await refreshYears();
    } finally {
      setAddingYear(false);
    }
  }, [refreshYears]);

  return {
    years,
    yearsLoading,
    // Nothing to show yet: first load with no cached tree, or first-run setup.
    treeLoading: years.length === 0 && (yearsLoading || bootstrapping),
    loadError: loadError && years.length === 0,
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
