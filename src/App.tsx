import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import Tour from "./components/Tour";
import StudyWidget from "./components/StudyWidget";
const VillageView = lazy(() => import("./components/VillageView"));
import { useView } from "./context/ViewContext";
import { useAuth } from "./context/AuthContext";
import { useHomework } from "./context/HomeworkContext";
import {
  getAllYearsAndSemesters,
  initializeYear,
  setCourseOrder,
  deleteYear,
  setYearColor,
  setSemesterColor,
  setCourseFinalDate,
  setCourseColor,
  addCourse,
} from "./utility/initializeDatabase";

export interface CourseTab {
  year: number;
  semester: string;
  course: string;
}

export interface CourseInfo {
  name: string;
  finalDate?: string;
  color?: string;
}

export interface YearTreeData {
  year: number;
  color?: string;
  semesters: { name: string; key: string; color?: string; courses: CourseInfo[] }[];
}

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const { view } = useView();
  const { fetchHomework } = useHomework();
  const [years, setYears] = useState<YearTreeData[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [tourRun, setTourRun] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const tourKey = user ? `oplanner.tour.done.${user.uid}` : null;

  const finishTour = () => {
    if (tourKey) localStorage.setItem(tourKey, "1");
    setTourRun(false);
  };

  useEffect(() => {
    if (tourRun) setMobileNavOpen(false);
  }, [tourRun]);

  const refreshYears = useCallback(async () => {
    if (!user) return;
    setYearsLoading(true);
    try {
      const data = await getAllYearsAndSemesters();
      setYears(data);
      try {
        localStorage.setItem(`oplanner.years.${user.uid}`, JSON.stringify(data));
      } catch {
        /* quota / private mode */
      }
    } finally {
      setYearsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setYears([]);
      return;
    }
    let hasCache = false;
    try {
      const cached = localStorage.getItem(`oplanner.years.${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          setYears(parsed);
          setYearsLoading(false);
          hasCache = true;
        }
      }
    } catch {
      /* ignore */
    }
    // Always pull fresh from Firestore so changes from another device show up.
    // Cache is only an optimistic first paint.
    refreshYears();
    void hasCache;
  }, [user, refreshYears]);

  // Bootstrap: brand-new account with zero years gets the current calendar
  // year auto-created so the overview is immediately useful. One-shot per
  // user — if they delete the year later we don't recreate it.
  useEffect(() => {
    if (!user || yearsLoading) return;
    if (years.length > 0) return;
    const flagKey = `oplanner.bootstrapped.${user.uid}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, "1");
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

  const ensureSampleCourse = useCallback(async () => {
    const sem = years
      .find((y) => y.year === selectedYear)
      ?.semesters.find((s) => s.name === selectedSemester);
    if (sem && sem.courses.length === 0 && selectedYear && selectedSemester) {
      await addCourse(selectedYear, selectedSemester, "Course 1");
      await refreshYears();
    }
  }, [years, selectedYear, selectedSemester, refreshYears]);

  const replayTour = async () => {
    if (tourKey) localStorage.removeItem(tourKey);
    await ensureSampleCourse();
    setTourRun(true);
  };

  useEffect(() => {
    if (!tourKey || yearsLoading) return;
    const done = localStorage.getItem(tourKey);
    if (done) return;
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

  // Helper: pick best semester for a given year tree.
  // Priority: per-year saved → heuristic by month → "Semester A" → first in tree.
  const pickSemesterForYear = useCallback(
    (yearTree: YearTreeData): string | null => {
      if (yearTree.semesters.length === 0) return null;
      if (user) {
        try {
          const raw = localStorage.getItem(`oplanner.lastSemesterByYear.${user.uid}`);
          if (raw) {
            const map = JSON.parse(raw) as Record<string, string>;
            const saved = map[String(yearTree.year)];
            if (saved && yearTree.semesters.some((s) => s.name === saved)) {
              return saved;
            }
          }
        } catch {
          /* ignore */
        }
      }
      // Heuristic by current month (Israeli academic calendar)
      const month = new Date().getMonth();
      const semesterByMonth =
        month >= 9 || month <= 1
          ? "Semester A"
          : month >= 2 && month <= 6
          ? "Semester B"
          : "Semester C";
      const semMatch = yearTree.semesters.find((s) => s.name === semesterByMonth);
      if (semMatch) return semMatch.name;
      const semA = yearTree.semesters.find((s) => s.name === "Semester A");
      if (semA) return semA.name;
      return yearTree.semesters[0]?.name ?? null;
    },
    [user]
  );

  useEffect(() => {
    if (selectedYear !== null || years.length === 0 || !user) return;

    // 1) Try last-opened year persisted
    let yearToOpen: YearTreeData | null = null;
    try {
      const raw = localStorage.getItem(`oplanner.lastSelection.${user.uid}`);
      if (raw) {
        const { year } = JSON.parse(raw) as { year?: number };
        const yMatch = years.find((y) => y.year === year);
        if (yMatch) yearToOpen = yMatch;
      }
    } catch {
      /* ignore */
    }

    // 2) Fallback to current calendar year, then most recent
    if (!yearToOpen) {
      const yearGuess = new Date().getFullYear();
      yearToOpen = years.find((y) => y.year === yearGuess) || years[years.length - 1];
    }
    if (!yearToOpen) return;

    setSelectedYear(yearToOpen.year);
    setSelectedSemester(pickSemesterForYear(yearToOpen));
  }, [years, selectedYear, user, pickSemesterForYear]);

  // Persist last-opened year + per-year semester whenever they change.
  useEffect(() => {
    if (!user || selectedYear === null) return;
    try {
      localStorage.setItem(
        `oplanner.lastSelection.${user.uid}`,
        JSON.stringify({ year: selectedYear })
      );
      if (selectedSemester) {
        const key = `oplanner.lastSemesterByYear.${user.uid}`;
        const raw = localStorage.getItem(key);
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        map[String(selectedYear)] = selectedSemester;
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }
  }, [user, selectedYear, selectedSemester]);

  const handleReorderCourses = (year: number, semester: string, names: string[]) => {
    setYears((prev) => {
      const next = prev.map((y) => {
        if (y.year !== year) return y;
        return {
          ...y,
          semesters: y.semesters.map((s) => {
            if (s.name !== semester) return s;
            const ordered = names
              .filter((n) => s.courses.some((c) => c.name === n))
              .map((n) => ({ name: n }));
            return { ...s, courses: ordered };
          }),
        };
      });
      if (user) {
        try {
          localStorage.setItem(`oplanner.years.${user.uid}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
    void setCourseOrder(year, semester, names);
  };

  const persistYears = (next: YearTreeData[]) => {
    if (user) {
      try {
        localStorage.setItem(`oplanner.years.${user.uid}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };

  const handleUpdateYearColor = async (year: number, color: string | null) => {
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
  };

  const handleUpdateSemesterColor = async (
    year: number,
    semesterKey: string,
    color: string | null
  ) => {
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
  };

  const handleUpdateCourseColor = async (
    year: number,
    semesterKey: string,
    course: string,
    color: string | null
  ) => {
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
  };

  const handleUpdateCourseFinalDate = async (
    year: number,
    semesterKey: string,
    course: string,
    date: string | null
  ) => {
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
    if (user) {
      try {
        localStorage.removeItem(
          `oplanner.homework.${user.uid}.${year}|${semesterKey}|${course}`
        );
      } catch {
        /* ignore */
      }
    }
    // Refresh in-memory homework so calendar and lists update immediately.
    await fetchHomework(year, semesterKey, course, true);
  };

  const handleDeleteYear = async (year: number) => {
    const ok = await deleteYear(year);
    if (!ok) return;
    if (selectedYear === year) {
      const remaining = years.filter((y) => y.year !== year);
      if (remaining.length > 0) {
        const next = remaining.reduce((a, b) => (a.year > b.year ? a : b));
        setSelectedYear(next.year);
        setSelectedSemester(pickSemesterForYear(next));
        setSelectedCourse(null);
      } else {
        setSelectedYear(null);
        setSelectedSemester(null);
        setSelectedCourse(null);
      }
    }
    await refreshYears();
  };

  const handleAddYear = async () => {
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
  };

  const activeTab: CourseTab | null = useMemo(
    () =>
      selectedYear !== null && selectedSemester && selectedCourse
        ? { year: selectedYear, semester: selectedSemester, course: selectedCourse }
        : null,
    [selectedYear, selectedSemester, selectedCourse]
  );

  const currentYear = years.find((y) => y.year === selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === selectedSemester) || null;
  const semesterCourses: CourseInfo[] = currentSemester?.courses ?? [];

  if (loading) {
    return (
      <div className="app-loading">
        <img src="./Logo.svg" alt="" className="app-loading-logo" />
        <div className="app-loading-text">OPlanner</div>
        <div className="app-loading-spinner">
          <i className="bx bx-loader-alt bx-spin"></i>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  if (view === "village") {
    return (
      <Suspense
        fallback={
          <div className="village-loading">
            <div className="village-loading-spinner" />
            <div className="village-loading-text">Loading village…</div>
          </div>
        }
      >
        <VillageView />
        <StudyWidget />
      </Suspense>
    );
  }

  return (
    <div className="app-container">
      <div className="mobile-topbar">
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <span /><span /><span />
        </button>
        <img src="./Logo.svg" alt="" className="mobile-topbar-logo" />
        <span className="mobile-topbar-name">OPlanner</span>
      </div>
      {mobileNavOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        selectedCourse={selectedCourse}
        courses={semesterCourses}
        onSelectCourse={setSelectedCourse}
        onReorderCourses={handleReorderCourses}
        onYearsChanged={refreshYears}
        onAddYear={handleAddYear}
        addingYear={addingYear}
        onReplayTour={replayTour}
        onUpdateCourseColor={(year, semKey, course, color) =>
          handleUpdateCourseColor(year, semKey, course, color)
        }
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <MainContent
        years={years}
        addingYear={addingYear}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        onSelectYear={(y) => {
          if (y === selectedYear) return;
          setSelectedYear(y);
          const yearTree = years.find((yy) => yy.year === y);
          setSelectedSemester(yearTree ? pickSemesterForYear(yearTree) : null);
          setSelectedCourse(null);
        }}
        onSelectSemester={(s) => {
          if (s === selectedSemester) return;
          setSelectedSemester(s);
          setSelectedCourse(null);
        }}
        onSelectCourse={setSelectedCourse}
        onYearsChanged={refreshYears}
        onDeleteYear={handleDeleteYear}
        onUpdateYearColor={handleUpdateYearColor}
        onUpdateSemesterColor={handleUpdateSemesterColor}
        onUpdateCourseColor={handleUpdateCourseColor}
        onUpdateCourseFinalDate={handleUpdateCourseFinalDate}
        activeTab={activeTab}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <RightSidebar
        years={years}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        selectedCourse={selectedCourse}
      />
      <Tour run={tourRun} onFinish={finishTour} onSetMobileNav={setMobileNavOpen} />
      <StudyWidget />
    </div>
  );
};

export default App;
