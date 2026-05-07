import React, { useState, useEffect, useCallback } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";
import { getAllYearsAndSemesters, initializeYear } from "./utility/initializeDatabase";

export interface CourseTab {
  year: number;
  semester: string;
  course: string;
}

export const tabKey = (t: CourseTab): string =>
  `${t.year}|${t.semester}|${t.course}`;

export interface YearTreeData {
  year: number;
  semesters: { name: string; key: string; courses: { name: string }[] }[];
}

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [years, setYears] = useState<YearTreeData[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [openCourses, setOpenCourses] = useState<CourseTab[]>([]);
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
    try {
      const cached = localStorage.getItem(`oplanner.years.${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          setYears(parsed);
          setYearsLoading(false);
        }
      }
    } catch {
      /* ignore */
    }
    refreshYears();
  }, [user, refreshYears]);

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

  const openCourse = (year: number, semester: string, course: string) => {
    setSelectedYear(year);
    setSelectedSemester(semester);
    setSelectedCourse(course);
    const tab: CourseTab = { year, semester, course };
    const key = tabKey(tab);
    setOpenCourses((prev) =>
      prev.some((t) => tabKey(t) === key) ? prev : [...prev, tab]
    );
  };

  const closeCourse = (key: string) => {
    setOpenCourses((prev) => {
      const idx = prev.findIndex((t) => tabKey(t) === key);
      if (idx === -1) return prev;
      const next = prev.filter((t) => tabKey(t) !== key);
      const activeKey =
        selectedYear !== null && selectedSemester && selectedCourse
          ? `${selectedYear}|${selectedSemester}|${selectedCourse}`
          : null;
      if (activeKey === key) {
        const fallback = next[idx] || next[idx - 1] || next[0] || null;
        if (fallback) {
          setSelectedYear(fallback.year);
          setSelectedSemester(fallback.semester);
          setSelectedCourse(fallback.course);
        } else {
          setSelectedCourse(null);
        }
      }
      return next;
    });
  };

  const activeTab: CourseTab | null =
    selectedYear !== null && selectedSemester && selectedCourse
      ? { year: selectedYear, semester: selectedSemester, course: selectedCourse }
      : null;

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
        openCourses={openCourses}
        activeKey={activeTab ? tabKey(activeTab) : null}
        onSwitchTab={(key) => {
          const t = openCourses.find((c) => tabKey(c) === key);
          if (t) openCourse(t.year, t.semester, t.course);
        }}
        onCloseTab={closeCourse}
        onAddYear={handleAddYear}
        addingYear={addingYear}
      />
      <MainContent
        years={years}
        yearsLoading={yearsLoading}
        addingYear={addingYear}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        selectedCourse={selectedCourse}
        onSelectYear={(y) => {
          setSelectedYear(y);
          setSelectedSemester(null);
          setSelectedCourse(null);
        }}
        onSelectSemester={(s) => {
          setSelectedSemester(s);
          setSelectedCourse(null);
        }}
        onSelectCourse={(c) => {
          if (selectedYear !== null && selectedSemester) {
            openCourse(selectedYear, selectedSemester, c);
          }
        }}
        activeTab={activeTab}
        onYearsChanged={refreshYears}
      />
      <RightSidebar />
    </div>
  );
};

export default App;
