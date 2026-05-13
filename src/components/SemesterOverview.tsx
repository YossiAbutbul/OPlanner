import React, { useEffect, useRef, useState } from "react";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { parseIcs, IcsEvent } from "../utility/parseIcs";
import { CourseInfo } from "../App";
import { addCourse } from "../utility/initializeDatabase";
import { courseColor } from "../utility/courseColor";
import DatePicker from "./DatePicker";
import Modal from "./Modal";
import CourseCalendar from "./CourseCalendar";
import HomeworkModal from "./HomeworkModal";
import DayTasksModal from "./DayTasksModal";
import DeleteModal from "./DeleteModal";
import { Plus } from "lucide-react";
import "../css/SemesterOverview.css";

const REMINDERS_COURSE = "reminders";

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

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase());

interface CourseStats {
  course: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

const daysUntil = (iso: string): number => {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

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
  const [byCourse, setByCourse] = useState<CourseStats[]>([]);
  const [allTasks, setAllTasks] = useState<HomeworkEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [adding, setAdding] = useState(false);
  const [calSelected, setCalSelected] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefillDate, setTaskPrefillDate] = useState<string | null>(null);
  const [taskEditTask, setTaskEditTask] = useState<HomeworkEntry | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HomeworkEntry | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  const handleAddCourse = async () => {
    const trimmed = newCourseName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const name = capitalizeWords(trimmed);
      await addCourse(year, semesterKey, name);
      setNewCourseName("");
      setAddOpen(false);
      onYearsChanged();
      onSelectCourse(name);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to add course.");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveTask = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    _year: number,
    _semester: string,
    course: string,
    ignoreOverdue?: boolean
  ) => {
    try {
      setIsLoadingAction(true);
      await addHomework(id, name, dueDate, status, year, semesterKey, course, ignoreOverdue);
      setTaskModalOpen(false);
      setTaskEditTask(null);
      setTaskPrefillDate(null);
    } finally {
      setIsLoadingAction(false);
    }
  };

  // Reset the loaded gate only when the user navigates to a different
  // semester. Final-date / color edits mutate `courses` reference but
  // shouldn't blank the overview.
  useEffect(() => {
    setLoaded(false);
  }, [year, semesterKey]);

  // Stable key of course names so changes to per-course fields (finalDate,
  // color) don't refire the heavy task fetch.
  const courseNamesKey = courses.map((c) => c.name).sort().join("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lists, reminders] = await Promise.all([
        Promise.all(courses.map((c) => getCourseTasks(year, semesterKey, c.name))),
        getCourseTasks(year, semesterKey, REMINDERS_COURSE),
      ]);
      if (cancelled) return;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const stats: CourseStats[] = courses.map((course, i) => {
        const list = lists[i];
        const completed = list.filter((t) => t.status === "COMPLETED").length;
        const pending = list.filter((t) => t.status === "PENDING").length;
        const overdue = list.filter(
          (t) =>
            t.status === "PENDING" &&
            !t.ignoreOverdue &&
            t.dueDate < todayStr
        ).length;
        return { course: course.name, total: list.length, completed, pending, overdue };
      });
      setByCourse(stats);
      setAllTasks([...lists.flat(), ...reminders]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, semesterKey, courseNamesKey, getCourseTasks, homework]);

  const totals = byCourse.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      completed: acc.completed + s.completed,
      pending: acc.pending + s.pending,
      overdue: acc.overdue + s.overdue,
    }),
    { total: 0, completed: 0, pending: 0, overdue: 0 }
  );
  const completionPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  const handleFinalDateChange = (course: string, value: string) => {
    const next = value ? value : null;
    onUpdateCourseFinalDate(course, next).catch((err: Error) => {
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
        <div className="overview-header-actions">
          <button
            className="overview-import"
            data-tour="import"
            onClick={() => fileInputRef.current?.click()}
            title="Import calendar (.ics)"
          >
            Import calendar
          </button>
          <button
            className="overview-add-course"
            data-tour="add-course"
            onClick={() => setAddOpen(true)}
            title="Add course"
          >
            <Plus size={16} />
            <span>Add course</span>
          </button>
        </div>
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

      <Modal
        isOpen={addOpen}
        onClose={() => {
          if (adding) return;
          setAddOpen(false);
          setNewCourseName("");
        }}
        title="Add course"
        footer={
          <>
            <button
              className="app-modal-btn-cancel"
              onClick={() => {
                setAddOpen(false);
                setNewCourseName("");
              }}
              disabled={adding}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn-primary"
              onClick={handleAddCourse}
              disabled={adding || !newCourseName.trim()}
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </>
        }
      >
        <input
          autoFocus
          type="text"
          value={newCourseName}
          placeholder="Course name"
          onChange={(e) => setNewCourseName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddCourse();
          }}
          disabled={adding}
        />
      </Modal>

      {isEmpty ? (
        <section className="overview-cta">
          <div className="overview-cta-icon">📅</div>
          <h2>Plan your next semester</h2>
          <p>
            {semester} is empty. Add courses to start tracking tasks, set final exam
            dates, and import your calendar.
          </p>
        </section>
      ) : !loaded ? null : (
        <>
          <section className="overview-stats">
            <div className="stat-card">
              <div className="stat-label">Tasks</div>
              <div className="stat-value">{totals.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Completed</div>
              <div className="stat-value stat-good">{totals.completed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending</div>
              <div className="stat-value">{totals.pending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Overdue</div>
              <div className={`stat-value ${totals.overdue > 0 ? "stat-bad" : ""}`}>
                {totals.overdue}
              </div>
            </div>
            <div className="stat-card stat-card-wide">
              <div className="stat-label">Completion</div>
              <div className="stat-value">{completionPct}%</div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </section>

          <div className="overview-grid">
            <section className="overview-section overview-calendar-section">
              <CourseCalendar
                hint="Tip: tap a day to select it, tap again to add a task."
                tasks={allTasks}
                selectedDate={calSelected}
                onSelectDate={setCalSelected}
                onCreateOnDate={(date) => {
                  const has = allTasks.some((t) => t.dueDate === date);
                  if (has) {
                    setDayModalDate(date);
                  } else {
                    setTaskPrefillDate(date);
                    setTaskModalOpen(true);
                  }
                }}
                maxVisibleTasks={3}
                colorOf={(t) => {
                  const c = courses.find((co) => co.name === t.course);
                  return courseColor(t.course, c?.color);
                }}
              />
            </section>
            <div className="overview-grid-right">
            <section className="overview-section">
              <h2>Courses</h2>
              <ul className="course-stats">
                {byCourse.map((s) => {
                  const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
                  const courseInfo = courses.find((c) => c.name === s.course);
                  const color = courseColor(s.course, courseInfo?.color);
                  return (
                    <li
                      key={s.course}
                      className="course-stat"
                      onClick={() => onSelectCourse(s.course)}
                    >
                      <div className="course-stat-row">
                        <span className="course-stat-name">{capitalizeWords(s.course)}</span>
                        <span className="course-stat-meta">
                          {s.overdue > 0 && (
                            <span className="course-stat-overdue">{s.overdue} overdue · </span>
                          )}
                          {s.completed}/{s.total}
                        </span>
                      </div>
                      <div className="stat-bar">
                        <div
                          className="stat-bar-fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="overview-section">
              <h2>Finals Countdown</h2>
              <ul className="finals-list">
                {courses.map((c, idx) => {
                  const days = c.finalDate ? daysUntil(c.finalDate) : null;
                  let badge = "";
                  let badgeClass = "";
                  if (days !== null) {
                    if (days < 0) {
                      badge = `${Math.abs(days)}d ago`;
                      badgeClass = "finals-badge-past";
                    } else if (days === 0) {
                      badge = "Today";
                      badgeClass = "finals-badge-soon";
                    } else if (days <= 7) {
                      badge = `${days}d`;
                      badgeClass = "finals-badge-soon";
                    } else if (days <= 30) {
                      badge = `${days}d`;
                      badgeClass = "finals-badge-near";
                    } else {
                      badge = `${days}d`;
                      badgeClass = "finals-badge-far";
                    }
                  }
                  let formatted: string | null = null;
                  if (c.finalDate) {
                    const d = new Date(c.finalDate + "T00:00:00");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const yyyy = d.getFullYear();
                    formatted = `${dd}/${mm}/${yyyy}`;
                  }
                  return (
                    <li key={c.name} className="finals-row">
                      <span className="finals-row-name">{capitalizeWords(c.name)}</span>
                      <span className={`finals-badge${badge ? ` ${badgeClass}` : " finals-badge-empty"}`}>
                        {badge}
                      </span>
                      <DatePicker
                        value={c.finalDate ?? null}
                        onChange={(v) => handleFinalDateChange(c.name, v ?? "")}
                      >
                        {(open) => (
                          <button
                            type="button"
                            className="finals-date"
                            data-tour={idx === 0 ? "finals" : undefined}
                            onClick={open}
                          >
                            <svg
                              className="finals-date-icon"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            <span
                              className={`finals-date-label ${formatted ? "" : "empty"}`}
                              dir="ltr"
                            >
                              {formatted ?? "Set date"}
                            </span>
                          </button>
                        )}
                      </DatePicker>
                    </li>
                  );
                })}
              </ul>
            </section>
            </div>
          </div>
        </>
      )}
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
