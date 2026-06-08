import React, { Suspense, lazy, useCallback, useMemo, useEffect, useState } from "react";
import { Loader2, PanelRight } from "lucide-react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import PomodoroPage from "./components/PomodoroPage";
import ReminderAnnounceModal from "./components/ReminderAnnounceModal";

// Tour pulls in react-joyride (~100KB). One-shot per user, mostly never seen
// on repeat visits. Lazy-load so it doesn't bloat the initial JS bundle.
const Tour = lazy(() => import("./components/Tour"));
import { useAuth } from "./context/AuthContext";
import { useHomework } from "./context/HomeworkContext";
import { useYearTree } from "./hooks/useYearTree";
import { useSelection, pickSemesterForYear } from "./hooks/useSelection";
import { useOnboardingTour } from "./hooks/useOnboardingTour";
import { useOfflineToast } from "./hooks/useOfflineToast";
import { useEdgeSwipe } from "./hooks/useEdgeSwipe";
import { usePwaMobile } from "./hooks/usePwaMobile";
import { useReminders } from "./hooks/useReminders";
import type { CourseInfo } from "./types/models";

// Re-export so existing consumers (Sidebar, MainContent, SemesterOverview,
// RightSidebar) keep importing these from "../App".
export type { CourseInfo, YearTreeData, CourseTab } from "./types/models";

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const { fetchHomework } = useHomework();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Pomodoro is a standalone page that overlays the planner main area.
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  // Surface online/offline transitions via toasts.
  useOfflineToast();

  // Edge-swipe gestures — installed PWA on mobile only. In a regular tab the
  // edge gesture often collides with the browser's back/forward swipe.
  const pwaMobile = usePwaMobile();
  useEdgeSwipe({
    enabled: pwaMobile,
    onSwipeFromLeft: () => {
      // Don't double-open if either drawer is already showing.
      setMobileRightOpen(false);
      setMobileNavOpen(true);
    },
    onSwipeFromRight: () => {
      setMobileNavOpen(false);
      setMobileRightOpen(true);
    },
  });

  const bustHomeworkCache = useCallback(
    async (year: number, semester: string, course: string) => {
      await fetchHomework(year, semester, course, true);
    },
    [fetchHomework]
  );

  const tree = useYearTree(user, bustHomeworkCache);
  const sel = useSelection(user, tree.years);

  // Desktop reminder engine: scans the selected semester for upcoming exams
  // and tasks, firing OS notifications while the app is open.
  useReminders({
    years: tree.years,
    selectedYear: sel.selectedYear,
    selectedSemester: sel.selectedSemester,
  });
  const tour = useOnboardingTour({
    user,
    years: tree.years,
    yearsLoading: tree.yearsLoading,
    selectedYear: sel.selectedYear,
    selectedSemester: sel.selectedSemester,
    refreshYears: tree.refreshYears,
  });

  // Close mobile nav whenever the tour starts.
  useEffect(() => {
    if (tour.tourRun) {
      setMobileNavOpen(false);
      setMobileRightOpen(false);
    }
  }, [tour.tourRun]);

  const handleDeleteYear = useCallback(
    async (year: number) => {
      const ok = await tree.handleDeleteYear(year);
      if (!ok) return;
      if (sel.selectedYear === year) {
        const remaining = tree.years.filter((y) => y.year !== year);
        if (remaining.length > 0) {
          const next = remaining.reduce((a, b) => (a.year > b.year ? a : b));
          sel.setSelectedYear(next.year);
          sel.setSelectedSemester(pickSemesterForYear(user?.uid ?? null, next));
          sel.setSelectedCourse(null);
        } else {
          sel.setSelectedYear(null);
          sel.setSelectedSemester(null);
          sel.setSelectedCourse(null);
        }
      }
    },
    [tree, sel, user]
  );

  const activeTab = useMemo(
    () =>
      sel.selectedYear !== null && sel.selectedSemester && sel.selectedCourse
        ? { year: sel.selectedYear, semester: sel.selectedSemester, course: sel.selectedCourse }
        : null,
    [sel.selectedYear, sel.selectedSemester, sel.selectedCourse]
  );

  const currentYear = tree.years.find((y) => y.year === sel.selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === sel.selectedSemester) || null;
  const semesterCourses: CourseInfo[] = currentSemester?.courses ?? [];

  if (loading) {
    return (
      <div className="app-loading">
        <img src="./Logo.svg" alt="" className="app-loading-logo" />
        <div className="app-loading-text">OPlanner</div>
        <div className="app-loading-spinner">
          <Loader2 className="app-loading-spin" size={28} />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

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
        <button
          className="mobile-right-toggle"
          onClick={() => setMobileRightOpen(true)}
          aria-label="Open upcoming and day panel"
        >
          <PanelRight size={22} />
        </button>
      </div>
      {(mobileNavOpen || mobileRightOpen) && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => {
            setMobileNavOpen(false);
            setMobileRightOpen(false);
          }}
        />
      )}
      <Sidebar
        selectedYear={sel.selectedYear}
        selectedSemester={sel.selectedSemester}
        selectedCourse={sel.selectedCourse}
        courses={semesterCourses}
        onSelectCourse={(c) => { setPomodoroOpen(false); sel.setSelectedCourse(c); }}
        onReorderCourses={tree.handleReorderCourses}
        onYearsChanged={tree.refreshYears}
        onAddYear={tree.handleAddYear}
        addingYear={tree.addingYear}
        onReplayTour={tour.replayTour}
        onUpdateCourseColor={tree.handleUpdateCourseColor}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        pomodoroActive={pomodoroOpen}
        onOpenPomodoro={() => setPomodoroOpen((o) => !o)}
      />
      {pomodoroOpen ? (
        <div className="main-layout">
          <div className="main-content">
            <PomodoroPage />
          </div>
        </div>
      ) : (
      <MainContent
        years={tree.years}
        addingYear={tree.addingYear}
        selectedYear={sel.selectedYear}
        selectedSemester={sel.selectedSemester}
        onSelectYear={sel.selectYear}
        onSelectSemester={sel.selectSemester}
        onSelectCourse={sel.setSelectedCourse}
        onYearsChanged={tree.refreshYears}
        onDeleteYear={handleDeleteYear}
        onUpdateYearColor={tree.handleUpdateYearColor}
        onUpdateSemesterColor={tree.handleUpdateSemesterColor}
        onUpdateCourseColor={tree.handleUpdateCourseColor}
        onUpdateCourseFinalDate={tree.handleUpdateCourseFinalDate}
        activeTab={activeTab}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      )}
      <RightSidebar
        years={tree.years}
        selectedYear={sel.selectedYear}
        selectedSemester={sel.selectedSemester}
        selectedCourse={sel.selectedCourse}
        mobileOpen={mobileRightOpen}
      />

      {/* Tour chunk loads on demand; null fallback — invisible while loading. */}
      <Suspense fallback={null}>
        <Tour run={tour.tourRun} onFinish={tour.finishTour} onSetMobileNav={setMobileNavOpen} />
      </Suspense>

      <ReminderAnnounceModal />
    </div>
  );
};

export default App;
