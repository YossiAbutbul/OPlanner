import React, { useState, useEffect, useCallback } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";
import {
  getAllYearsAndSemesters,
  initializeYear,
  setCourseOrder,
  deleteYear,
  setYearColor,
  setSemesterColor,
  setCourseFinalDate,
} from "./utility/initializeDatabase";

export interface CourseTab {
  year: number;
  semester: string;
  course: string;
}

export interface CourseInfo {
  name: string;
  finalDate?: string;
}

export interface YearTreeData {
  year: number;
  color?: string;
  semesters: { name: string; key: string; color?: string; courses: CourseInfo[] }[];
}

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [years, setYears] = useState<YearTreeData[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);

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
    if (!hasCache) refreshYears();
  }, [user, refreshYears]);

  useEffect(() => {
    if (selectedYear !== null || years.length === 0) return;
    const now = new Date().getFullYear();
    const match = years.find((y) => y.year === now) || years[years.length - 1];
    if (match) {
      setSelectedYear(match.year);
      if (match.semesters.length > 0) {
        setSelectedSemester(match.semesters[0].name);
      }
    }
  }, [years, selectedYear]);

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
  };

  const handleDeleteYear = async (year: number) => {
    const ok = await deleteYear(year);
    if (!ok) return;
    if (selectedYear === year) {
      setSelectedYear(null);
      setSelectedSemester(null);
      setSelectedCourse(null);
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

  const activeTab: CourseTab | null =
    selectedYear !== null && selectedSemester && selectedCourse
      ? { year: selectedYear, semester: selectedSemester, course: selectedCourse }
      : null;

  const currentYear = years.find((y) => y.year === selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === selectedSemester) || null;
  const semesterCourses = currentSemester?.courses.map((c) => c.name) || [];

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

  return (
    <div className="app-container">
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
        onSync={refreshYears}
        syncing={yearsLoading}
      />
      <MainContent
        years={years}
        addingYear={addingYear}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        onSelectYear={(y) => {
          if (y === selectedYear) return;
          setSelectedYear(y);
          setSelectedSemester(null);
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
        onUpdateCourseFinalDate={handleUpdateCourseFinalDate}
        activeTab={activeTab}
      />
      <RightSidebar
        years={years}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        selectedCourse={selectedCourse}
      />
    </div>
  );
};

export default App;
