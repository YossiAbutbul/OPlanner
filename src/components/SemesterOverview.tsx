import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useToast } from "../context/ToastContext";
import { parseIcs, IcsEvent } from "../utility/parseIcs";
import { courseColor } from "../utility/courseColor";
import { FINAL_TASK_ID } from "../services/homework";
import CourseCalendar from "./CourseCalendar";
import DayTasksModal from "./DayTasksModal";
import DeleteModal from "./DeleteModal";

// HomeworkModal is the heaviest — only mounted on first open.
const HomeworkModal = lazy(() => import("./HomeworkModal"));
import OverviewStats from "./SemesterOverview/OverviewStats";
import CoursesPanel from "./SemesterOverview/CoursesPanel";
import FinalsCountdown from "./SemesterOverview/FinalsCountdown";
import SemesterGrades from "./SemesterOverview/SemesterGrades";
import AddCourseModal from "./SemesterOverview/AddCourseModal";
import OverviewSkeleton from "./SemesterOverview/OverviewSkeleton";
import { useSemesterStats } from "../hooks/useSemesterStats";
import type { CourseInfo, HomeworkEntry } from "../types/models";
import { BookPlus, Download } from "lucide-react";
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
  const { getCourseTasks, homework, addHomework, removeHomework, applyEdits } = useHomework();
  const toast = useToast();
  const { byCourse, allTasks, loaded, totals, completionPct } = useSemesterStats(
    year,
    semesterKey,
    courses,
    homework,
    getCourseTasks,
    applyEdits
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

  const finalTaskOf = (course: string) =>
    allTasks.find((t) => t.course === course && t.id === FINAL_TASK_ID);

  const handleFinalDateChange = (course: string, value: string) => {
    const next = value ? value : null;
    const final = finalTaskOf(course);
    // An existing Final Exam task is edited in place (optimistic, keeps its
    // status); the homework context carries the date to the course.
    if (final) {
      if (next) {
        void addHomework(
          final.id, final.name, next, final.status, final.year, final.semester, final.course,
          final.ignoreOverdue, undefined, final.startTime, final.endTime, final.notes, final.color
        );
        toast.success("Final exam date saved");
      } else {
        void removeHomework(final.id, final.year, final.semester, final.course);
        toast.success("Final exam date cleared");
      }
      return;
    }
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
              onClick={() => fileInputRef.current?.click()}
              title="Import calendar (.ics)"
            >
              <Download size={16} />
              <span>Import calendar</span>
            </button>
            <button
              className="overview-add-course"
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
        <section className="ov-setup">
          {/* A faint picture of the finished overview, so the empty page
              shows what the two choices below lead to. */}
          <div className="ov-setup-ghost" aria-hidden="true">
            <div className="ov-ghost-row">
              <div className="ov-ghost-card">
                <i className="ov-ghost-line w30 tall" />
                <i className="ov-ghost-bar" />
                <div className="ov-ghost-stats">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="ov-ghost-card">
                <i className="ov-ghost-line w20" />
                <i className="ov-ghost-line w70" />
                <i className="ov-ghost-line w55" />
              </div>
            </div>
            <div className="ov-ghost-row">
              <div className="ov-ghost-card ov-ghost-cal">
                {Array.from({ length: 35 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="ov-ghost-card">
                <i className="ov-ghost-line w30" />
                <i className="ov-ghost-line w80" />
                <i className="ov-ghost-line w80" />
                <i className="ov-ghost-line w60" />
              </div>
            </div>
          </div>

          <div className="ov-setup-panel">
            <h2 className="ov-setup-title">Set up {semester}</h2>
            <p className="ov-setup-text">
              Bring in your courses to start tracking assignments, deadlines and finals.
            </p>
            <div className="ov-setup-choices">
              <button
                type="button"
                className="ov-choice ov-choice-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="ov-choice-icon">
                  <Download size={20} strokeWidth={2} />
                </span>
                <span className="ov-choice-badge">Recommended</span>
                <span className="ov-choice-title">Import your calendar</span>
                <span className="ov-choice-text">
                  Upload the .ics from your university. Courses and deadlines appear in seconds.
                </span>
              </button>
              <button type="button" className="ov-choice" onClick={() => setAddOpen(true)}>
                <span className="ov-choice-icon">
                  <BookPlus size={20} strokeWidth={2} />
                </span>
                <span className="ov-choice-title">Add a course</span>
                <span className="ov-choice-text">Type a course name and add its tasks yourself.</span>
              </button>
            </div>
            <p className="ov-setup-foot">You can add, rename or remove courses anytime.</p>
          </div>
        </section>
      ) : !loaded ? (
        <OverviewSkeleton courses={courses} />
      ) : (
        <>
          <OverviewStats
            totals={totals}
            completionPct={completionPct}
            tasks={allTasks}
            colorOf={(t) => {
              if (t.color) return t.color;
              const c = courses.find((co) => co.name === t.course);
              return courseColor(t.course, c?.color);
            }}
            onOpenTask={(t) => {
              setTaskEditTask(t);
              setTaskModalOpen(true);
            }}
          />

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
              <FinalsCountdown
                courses={courses}
                onChangeFinalDate={handleFinalDateChange}
                finalStatusOf={(course) => finalTaskOf(course)?.status}
                finalDateOf={(course) => finalTaskOf(course)?.dueDate}
                onOpenFinal={(course) => {
                  const final = allTasks.find(
                    (t) => t.course === course && t.id === FINAL_TASK_ID
                  );
                  if (!final) return;
                  setTaskEditTask(final);
                  setTaskModalOpen(true);
                }}
              />
              <SemesterGrades
                year={year}
                semester={semester}
                courses={courses}
                onSelectCourse={onSelectCourse}
              />
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
            onDelete={
              taskEditTask
                ? async () => {
                    const t = taskEditTask;
                    await removeHomework(t.id, t.year, t.semester, t.course);
                    toast.success(`Deleted “${t.name}”`);
                  }
                : undefined
            }
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
