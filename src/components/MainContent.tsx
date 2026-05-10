import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import SemesterOverview from "./SemesterOverview";
import ImportCalendarModal from "./ImportCalendarModal";
import CourseCalendar from "./CourseCalendar";
import DayTasksModal from "./DayTasksModal";
import DeleteModal from "./DeleteModal";
import TabSettingsModal from "./TabSettingsModal";
import Modal from "./Modal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { CourseTab, YearTreeData } from "../App";
import { IcsEvent } from "../utility/parseIcs";

interface MainContentProps {
  years: YearTreeData[];
  addingYear: boolean;
  selectedYear: number | null;
  selectedSemester: string | null;
  onSelectYear: (y: number) => void;
  onSelectSemester: (s: string) => void;
  onSelectCourse: (c: string) => void;
  onYearsChanged: () => void;
  onDeleteYear: (year: number) => Promise<void>;
  onUpdateYearColor: (year: number, color: string | null) => Promise<void>;
  onUpdateSemesterColor: (year: number, semesterKey: string, color: string | null) => Promise<void>;
  onUpdateCourseColor: (
    year: number,
    semesterKey: string,
    course: string,
    color: string | null
  ) => Promise<void>;
  onUpdateCourseFinalDate: (
    year: number,
    semesterKey: string,
    course: string,
    date: string | null
  ) => Promise<void>;
  activeTab: CourseTab | null;
  onCloseMobile: () => void;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const MainContent: React.FC<MainContentProps> = ({
  years,
  addingYear,
  selectedYear,
  selectedSemester,
  onSelectYear,
  onSelectSemester,
  onSelectCourse,
  onYearsChanged,
  onDeleteYear,
  onUpdateYearColor,
  onUpdateSemesterColor,
  onUpdateCourseColor,
  onUpdateCourseFinalDate,
  activeTab,
  onCloseMobile,
}) => {
  const { homework, fetchHomework, addHomework, removeHomework } = useHomework();
  const [filteredHomework, setFilteredHomework] = useState<HomeworkEntry[]>([]);
  const [isHomeworkModalOpen, setHomeworkModalOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [icsEvents, setIcsEvents] = useState<IcsEvent[] | null>(null);
  const [calDate, setCalDate] = useState<string | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<HomeworkEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HomeworkEntry | null>(null);
  const [confirmDeleteYear, setConfirmDeleteYear] = useState<number | null>(null);
  const [tabSettings, setTabSettings] = useState<
    | { kind: "year"; year: number; color?: string }
    | { kind: "semester"; year: number; semester: string; color?: string }
    | { kind: "course"; year: number; semester: string; course: string; color?: string }
    | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab) {
      fetchHomework(activeTab.year, activeTab.semester, activeTab.course);
    }
  }, [activeTab, fetchHomework]);

  useEffect(() => {
    if (activeTab) {
      setFilteredHomework(homework.filter((hw) => hw.course === activeTab.course));
    } else {
      setFilteredHomework([]);
    }
  }, [activeTab, homework]);

  useEffect(() => {
    setCalDate(null);
    const el = document.querySelector(".main-content") as HTMLElement | null;
    if (el) el.scrollTop = 0;
  }, [activeTab]);

  const tableTasks = filteredHomework;

  const sortedYears = [...years].sort((a, b) => a.year - b.year);
  const currentYear = years.find((y) => y.year === selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === selectedSemester) || null;

  const handleSaveHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    _year: number,
    _semester: string,
    _course: string,
    ignoreOverdue?: boolean
  ) => {
    if (!activeTab) return;
    const { year, semester, course } = activeTab;
    const capitalizedCourse = capitalizeWords(course);
    try {
      setIsLoadingAction(true);
      await addHomework(
        id,
        name,
        dueDate,
        status,
        year,
        semester,
        capitalizedCourse,
        ignoreOverdue
      );
      setHomeworkModalOpen(false);
    } finally {
      setIsLoadingAction(false);
    }
  };

  return (
    <div className="main-layout">
      {/* Year tabs */}
      <div className="tab-bar tab-bar-year">
        {sortedYears.map((y) => {
          let pressTimer: ReturnType<typeof setTimeout> | null = null;
          let pressFired = false;
          const startPress = () => {
            pressFired = false;
            pressTimer = setTimeout(() => {
              pressFired = true;
              setTabSettings({ kind: "year", year: y.year, color: y.color });
            }, 500);
          };
          const cancelPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = null;
          };
          return (
          <div
            key={y.year}
            className={`tab year-tab ${selectedYear === y.year ? "active" : ""}`}
            style={y.color ? ({ "--tab-color": y.color } as React.CSSProperties) : undefined}
            onClick={() => { if (!pressFired) onSelectYear(y.year); }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTabSettings({ kind: "year", year: y.year, color: y.color });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setTabSettings({ kind: "year", year: y.year, color: y.color });
            }}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
          >
            {y.color && <span className="tab-color-dot" style={{ background: y.color }} />}
            <span>{y.year}</span>
            <button
              type="button"
              className="year-tab-delete"
              title="Delete year"
              aria-label={`Delete year ${y.year}`}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteYear(y.year);
                onCloseMobile();
              }}
            >
              ×
            </button>
          </div>
          );
        })}
        {addingYear && (
          <span className="year-adding" title="Adding year…" aria-label="Adding year">
            <span className="year-adding-spinner" />
            <span className="year-adding-label">Adding…</span>
          </span>
        )}
      </div>

      {/* Semester tabs */}
      <div className="tab-bar tab-bar-semester">
        {currentYear &&
          currentYear.semesters.map((s) => (
            <button
              key={s.key}
              className={`tab semester-tab ${selectedSemester === s.name ? "active" : ""}`}
              style={s.color ? ({ "--tab-color": s.color } as React.CSSProperties) : undefined}
              onClick={() => onSelectSemester(s.name)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (currentYear) {
                  setTabSettings({
                    kind: "semester",
                    year: currentYear.year,
                    semester: s.key,
                    color: s.color,
                  });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (currentYear) {
                  setTabSettings({
                    kind: "semester",
                    year: currentYear.year,
                    semester: s.key,
                    color: s.color,
                  });
                }
              }}
            >
              {s.color && <span className="tab-color-dot" style={{ background: s.color }} />}
              {s.name}
            </button>
          ))}
      </div>

      {/* Content */}
      <div className="main-content">
        {activeTab ? (
          <>
            <header className="course-header">
              <div className="course-header-text">
                <h1>{capitalizeWords(activeTab.course)}</h1>
                <h2>{activeTab.semester}, {activeTab.year}</h2>
              </div>
              <button
                className="course-add-task"
                onClick={() => setHomeworkModalOpen(true)}
              >
                New task
              </button>
            </header>
            <div className="course-row">
              <div className="course-progress">
                <ProgressChart
                  completed={filteredHomework.filter((hw) => hw.status === "COMPLETED").length}
                  pending={filteredHomework.filter((hw) => hw.status === "PENDING").length}
                />
              </div>
              <div className="course-calendar">
                <CourseCalendar
                  hint="Tip: tap a day to select it, tap again to add a task."
                  tasks={filteredHomework}
                  selectedDate={calDate}
                  onSelectDate={setCalDate}
                  onCreateOnDate={(date) => {
                    const has = filteredHomework.some((t) => t.dueDate === date);
                    if (has) {
                      setDayModalDate(date);
                    } else {
                      setPrefillDate(date);
                      setHomeworkModalOpen(true);
                    }
                  }}
                />
              </div>
            </div>
            <div className="homework-table-container">
              <HomeworkTable
                tasks={tableTasks}
                onAddTask={() => setHomeworkModalOpen(true)}
              />
            </div>
          </>
        ) : selectedYear !== null && selectedSemester && currentSemester ? (
          <SemesterOverview
            year={selectedYear}
            semester={selectedSemester}
            semesterKey={currentSemester.key}
            courses={currentSemester.courses}
            onSelectCourse={onSelectCourse}
            onImport={setIcsEvents}
            onUpdateCourseFinalDate={(course, date) =>
              onUpdateCourseFinalDate(selectedYear, currentSemester.key, course, date)
            }
            onYearsChanged={onYearsChanged}
            onError={(msg) => setErrorMsg(msg)}
          />
        ) : (
          <div className="empty-state" />
        )}
      </div>

      {icsEvents && (
        <ImportCalendarModal
          isOpen={!!icsEvents}
          onClose={() => setIcsEvents(null)}
          events={icsEvents}
          onDone={onYearsChanged}
        />
      )}

      <HomeworkModal
        isOpen={isHomeworkModalOpen}
        onClose={() => {
          setHomeworkModalOpen(false);
          setPrefillDate(null);
          setEditTask(null);
        }}
        onSave={handleSaveHomework}
        selectedCourseData={activeTab}
        editHomework={editTask}
        prefilledDueDate={prefillDate}
        isLoading={isLoadingAction}
      />

      {dayModalDate && activeTab && (
        <DayTasksModal
          isOpen={!!dayModalDate}
          date={dayModalDate}
          tasks={filteredHomework.filter((t) => t.dueDate === dayModalDate)}
          onClose={() => setDayModalDate(null)}
          onAdd={() => {
            setPrefillDate(dayModalDate);
            setDayModalDate(null);
            setHomeworkModalOpen(true);
          }}
          onEdit={(t) => {
            setEditTask(t);
            setDayModalDate(null);
            setHomeworkModalOpen(true);
          }}
          onDelete={(t) => setConfirmDelete(t)}
        />
      )}

      {confirmDelete && (
        <DeleteModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const t = confirmDelete;
            await removeHomework(t.id, t.year, t.semester, t.course);
            setConfirmDelete(null);
            // if the day has no more tasks, close the day modal
            if (dayModalDate) {
              const remaining = filteredHomework.filter(
                (x) => x.dueDate === dayModalDate && x.id !== t.id
              );
              if (remaining.length === 0) setDayModalDate(null);
            }
          }}
          title="Confirm Delete"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
        />
      )}

      {tabSettings && (
        <TabSettingsModal
          isOpen={!!tabSettings}
          title={
            tabSettings.kind === "year"
              ? "Year settings"
              : tabSettings.kind === "semester"
              ? "Semester settings"
              : "Course settings"
          }
          label={
            tabSettings.kind === "year"
              ? String(tabSettings.year)
              : tabSettings.kind === "semester"
              ? tabSettings.semester
              : capitalizeWords(tabSettings.course)
          }
          currentColor={tabSettings.color}
          onClose={() => setTabSettings(null)}
          onSave={async (color) => {
            try {
              if (tabSettings.kind === "year") {
                await onUpdateYearColor(tabSettings.year, color);
              } else if (tabSettings.kind === "semester") {
                await onUpdateSemesterColor(
                  tabSettings.year,
                  tabSettings.semester,
                  color
                );
              } else {
                await onUpdateCourseColor(
                  tabSettings.year,
                  tabSettings.semester,
                  tabSettings.course,
                  color
                );
              }
            } catch (err) {
              setErrorMsg(
                err instanceof Error ? err.message : "Something went wrong."
              );
              throw err;
            }
          }}
        />
      )}

      {errorMsg && (
        <Modal
          isOpen={!!errorMsg}
          onClose={() => setErrorMsg(null)}
          title="Error"
          footer={
            <button
              type="button"
              className="app-modal-btn-primary"
              onClick={() => setErrorMsg(null)}
            >
              OK
            </button>
          }
        >
          <p>{errorMsg}</p>
        </Modal>
      )}

      {confirmDeleteYear !== null && (
        <DeleteModal
          isOpen={confirmDeleteYear !== null}
          onClose={() => setConfirmDeleteYear(null)}
          onConfirm={async () => {
            const y = confirmDeleteYear;
            if (y !== null) await onDeleteYear(y);
            setConfirmDeleteYear(null);
          }}
          title="Delete year"
          message={`Delete year ${confirmDeleteYear} and all its semesters, courses, and tasks? This cannot be undone.`}
        />
      )}
    </div>
  );
};

export default MainContent;
