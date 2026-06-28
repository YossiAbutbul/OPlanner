import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useToast } from "../context/ToastContext";
import { parseIcs, IcsEvent } from "../utility/parseIcs";
import { courseColor } from "../utility/courseColor";
import CourseCalendar from "./CourseCalendar";
import DayTasksModal from "./DayTasksModal";
import DeleteModal from "./DeleteModal";

// HomeworkModal is the heaviest — only mounted on first open.
const HomeworkModal = lazy(() => import("./HomeworkModal"));
import OverviewStats from "./SemesterOverview/OverviewStats";
import CoursesPanel from "./SemesterOverview/CoursesPanel";
import FinalsCountdown from "./SemesterOverview/FinalsCountdown";
import AddCourseModal from "./SemesterOverview/AddCourseModal";
import { useSemesterStats } from "../hooks/useSemesterStats";
import type { CourseInfo, HomeworkEntry } from "../types/models";
import { BookPlus, CalendarClock, CalendarPlus, Download, ListChecks } from "lucide-react";
import "../css/SemesterOverview.css";

interface Props {
  year: number;
  semester: string;
  semesterKey: string;
  courses: CourseInfo[];
  onSelectCourse: (c: string) => void;
  onImport: (events: IcsEvent[]) => void;
  onUpdateCourseFinalDate: (course: string, date: string | null) => Promise<void>;
  onYearsChanged: () => void;
  onError: (msg: string) => void;
}

const SemesterOverview: React.FC<Props> = ({
  year,
  semester,
  semesterKey,
  courses,
  onSelectCourse,
  onImport,
  onUpdateCourseFinalDate,
  onYearsChanged,
  onError,
}) => {
  const { getCourseTasks, homework, addHomework, removeHomework } = useHomework();
  const toast = useToast();
  const { byCourse, allTasks, loaded, totals, completionPct } = useSemesterStats(
    year,
    semesterKey,
    courses,
    homework,
    getCourseTasks
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [calSelected, setCalSelected] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefillDate, setTaskPrefillDate] = useState<string | null>(null);
  const [taskEditTask, setTaskEditTask] = useState<HomeworkEntry | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HomeworkEntry | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  // External "open this day in sidebar" requests sync the highlight here.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (detail?.date) setCalSelected(detail.date);
    };
    window.addEventListener("oplanner:select-day", onPick);
    return () => window.removeEventListener("oplanner:select-day", onPick);
  }, []);

  const handleSaveTask = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    _year: number,
    _semester: string,
    course: string,
    ignoreOverdue?: boolean,
    startTime?: string,
    endTime?: string,
    notes?: string,
    color?: string
  ) => {
    try {
      setIsLoadingAction(true);
      const prevLocation = id && taskEditTask
        ? { year: taskEditTask.year, semester: taskEditTask.semester, course: taskEditTask.course }
        : undefined;
      await addHomework(id, name, dueDate, status, year, semesterKey, course, ignoreOverdue, prevLocation, startTime, endTime, notes, color);
      setCalSelected(dueDate);
      setTaskModalOpen(false);
      setTaskEditTask(null);
      setTaskPrefillDate(null);
      toast.success(id ? `Task “${name}” updated` : `Task “${name}” added`);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleFinalDateChange = (course: string, value: string) => {
    const next = value ? value : null;
    onUpdateCourseFinalDate(course, next)
      .then(() => {
        toast.success(next ? "Final exam date saved" : "Final exam date cleared");
      })
      .catch((err: Error) => {
        onError(err.message || "Failed to save final date.");
      });
  };

  const isEmpty = courses.length === 0;

  return (
    <div className="overview">
      <header className="overview-header">
        <div className="overview-header-title">
          <h1>{semester}</h1>
          <span className="overview-year">{year}</span>
        </div>
        {!isEmpty && (
          <div className="overview-header-actions">
            <button
              className="overview-import"
              data-tour="import"
              onClick={() => fileInputRef.current?.click()}
              title="Import calendar (.ics)"
            >
              <Download size={16} />
              <span>Import calendar</span>
            </button>
            <button
              className="overview-add-course"
              data-tour="add-course"
              onClick={() => setAddOpen(true)}
              title="Add course"
            >
              <BookPlus size={16} />
              <span>Add course</span>
            </button>
          </div>
        )}
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
            onImport(parseIcs(text));
          }}
        />
      </header>

      <AddCourseModal
        isOpen={addOpen}
        year={year}
        semesterKey={semesterKey}
        onClose={() => setAddOpen(false)}
        onAdded={(name) => {
          setAddOpen(false);
          onYearsChanged();
          onSelectCourse(name);
          toast.success(`Course “${name}” added`);
        }}
        onError={onError}
      />

      {isEmpty ? (
        <section className="overview-empty">
          <div className="overview-empty-art" aria-hidden="true">
            <CalendarPlus size={32} strokeWidth={1.7} />
          </div>
          <h2 className="overview-empty-title">Let's build {semester}</h2>
          <p className="overview-empty-text">
            No courses here yet. Add your first one to start tracking tasks,
            counting down to finals and importing your calendar.
          </p>
          <div className="overview-empty-actions">
            <button
              className="overview-add-course"
              data-tour="add-course"
              onClick={() => setAddOpen(true)}
            >
              <BookPlus size={16} />
              <span>Add your first course</span>
            </button>
            <button
              className="overview-import"
              data-tour="import"
              onClick={() => fileInputRef.current?.click()}
            >
              <Download size={16} />
              <span>Import calendar</span>
            </button>
          </div>
          <ul className="overview-empty-hints">
            <li>
              <ListChecks size={16} strokeWidth={2} />
              Track every assignment
            </li>
            <li>
              <CalendarClock size={16} strokeWidth={2} />
              Live finals countdown
            </li>
            <li>
              <CalendarPlus size={16} strokeWidth={2} />
              One-click .ics import
            </li>
          </ul>
        </section>
      ) : !loaded ? null : (
        <>
          <OverviewStats totals={totals} completionPct={completionPct} />

          <div className="overview-grid">
            <section className="overview-section overview-calendar-section">
              <CourseCalendar
                hint="Tip: double-click a day to add a task."
                tasks={allTasks}
                selectedDate={calSelected}
                onSelectDate={(d) => {
                  setCalSelected(d);
                  if (d) window.dispatchEvent(new CustomEvent("oplanner:select-day", { detail: { date: d } }));
                }}
                onCreateOnDate={(date) => {
                  const has = allTasks.some((t) => t.dueDate === date);
                  if (has) {
                    setDayModalDate(date);
                  } else {
                    setTaskPrefillDate(date);
                    setTaskModalOpen(true);
                  }
                }}
                maxVisibleTasks={2}
                colorOf={(t) => {
                  if (t.color) return t.color; // reminder/task picked color
                  if (t.course === "reminders") return "#7c4dff";
                  const c = courses.find((co) => co.name === t.course);
                  return courseColor(t.course, c?.color);
                }}
              />
            </section>
            <div className="overview-grid-right">
              <CoursesPanel byCourse={byCourse} courses={courses} onSelectCourse={onSelectCourse} />
              <FinalsCountdown courses={courses} onChangeFinalDate={handleFinalDateChange} />
            </div>
          </div>
        </>
      )}

      {taskModalOpen && (
        <Suspense fallback={null}>
          <HomeworkModal
            isOpen={taskModalOpen}
            onClose={() => {
              setTaskModalOpen(false);
              setTaskPrefillDate(null);
              setTaskEditTask(null);
            }}
            onSave={handleSaveTask}
            selectedCourseData={{ year, semester: semesterKey }}
            editHomework={taskEditTask}
            prefilledDueDate={taskPrefillDate}
            isLoading={isLoadingAction}
            availableCourses={courses.map((c) => c.name)}
          />
        </Suspense>
      )}

      {dayModalDate && (
        <DayTasksModal
          isOpen={!!dayModalDate}
          date={dayModalDate}
          tasks={allTasks.filter((t) => t.dueDate === dayModalDate)}
          showCourse
          onClose={() => setDayModalDate(null)}
          onAdd={() => {
            setTaskPrefillDate(dayModalDate);
            setDayModalDate(null);
            setTaskModalOpen(true);
          }}
          onEdit={(t) => {
            setTaskEditTask(t);
            setDayModalDate(null);
            setTaskModalOpen(true);
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
            toast.success(`Deleted “${t.name}”`);
            if (dayModalDate) {
              const remaining = allTasks.filter(
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

export default SemesterOverview;
