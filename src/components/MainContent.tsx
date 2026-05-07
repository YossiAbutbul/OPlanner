import React, { useRef, useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import SemesterOverview from "./SemesterOverview";
import ImportCalendarModal from "./ImportCalendarModal";
import CourseCalendar from "./CourseCalendar";
import DayTasksModal from "./DayTasksModal";
import DeleteModal from "./DeleteModal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { CourseTab, YearTreeData } from "../App";
import { parseIcs, IcsEvent } from "../utility/parseIcs";

interface MainContentProps {
  years: YearTreeData[];
  addingYear: boolean;
  selectedYear: number | null;
  selectedSemester: string | null;
  onSelectYear: (y: number) => void;
  onSelectSemester: (s: string) => void;
  onSelectCourse: (c: string) => void;
  onYearsChanged: () => void;
  activeTab: CourseTab | null;
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
  activeTab,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [activeTab]);

  const tableTasks = calDate
    ? filteredHomework.filter((t) => t.dueDate === calDate)
    : filteredHomework;

  const sortedYears = [...years].sort((a, b) => a.year - b.year);
  const currentYear = years.find((y) => y.year === selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === selectedSemester) || null;

  const handleSaveHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    if (!activeTab) return;
    const { year, semester, course } = activeTab;
    const capitalizedCourse = capitalizeWords(course);
    try {
      setIsLoadingAction(true);
      await addHomework(id, name, dueDate, status, year, semester, capitalizedCourse);
      setHomeworkModalOpen(false);
    } finally {
      setIsLoadingAction(false);
    }
  };

  return (
    <div className="main-layout">
      {/* Year tabs */}
      <div className="tab-bar tab-bar-year">
        <div className="tab-bar-left">
          {sortedYears.map((y) => (
            <button
              key={y.year}
              className={`tab year-tab ${selectedYear === y.year ? "active" : ""}`}
              onClick={() => onSelectYear(y.year)}
            >
              {y.year}
            </button>
          ))}
          {addingYear && <div className="tab skeleton skeleton-year"></div>}
        </div>
        <div className="tab-bar-right">
          <button
            className="tab tab-import"
            onClick={() => fileInputRef.current?.click()}
            title="Import calendar (.ics)"
          >
            <span>Import calendar</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const text = await f.text();
              setIcsEvents(parseIcs(text));
            }}
          />
        </div>
      </div>

      {/* Semester tabs */}
      <div className="tab-bar tab-bar-semester">
        {currentYear &&
          currentYear.semesters.map((s) => (
            <button
              key={s.key}
              className={`tab semester-tab ${selectedSemester === s.name ? "active" : ""}`}
              onClick={() => onSelectSemester(s.name)}
            >
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
            {calDate && (
              <div className="course-filter-bar">
                Filtered to <strong>{calDate}</strong>
                <button onClick={() => setCalDate(null)}>Clear</button>
              </div>
            )}
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
            courses={currentSemester.courses.map((c) => c.name)}
            onSelectCourse={onSelectCourse}
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
            setConfirmDelete(null);
            await removeHomework(t.id, t.year, t.semester, t.course);
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
    </div>
  );
};

export default MainContent;
