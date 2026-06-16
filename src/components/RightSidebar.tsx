import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useTimeBlocks } from "../context/TimeBlockContext";
import { useToast } from "../context/ToastContext";

// Heavy form modals — only mounted when the user actually opens them, so
// their chunks fetch on first interaction instead of in the initial bundle.
const HomeworkModal = lazy(() => import("./HomeworkModal"));
const TimeBlockModal = lazy(() => import("./TimeBlockModal"));
import UpcomingPanel from "./RightSidebar/UpcomingPanel";
import DayPanel from "./RightSidebar/DayPanel";
import { courseColor } from "../utility/courseColor";
import { isOverdue, startOfDay, toIso } from "../utility/dayCalendar";
import type { HomeworkEntry, TimeBlock, YearTreeData } from "../types/models";
import "../css/RightSidebar.css";

interface RightSidebarProps {
  years: YearTreeData[];
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
  mobileOpen?: boolean;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  years,
  selectedYear,
  selectedSemester,
  selectedCourse,
  mobileOpen = false,
}) => {
  const { getCourseTasks, addHomework, removeHomework, homework } = useHomework();
  const { blocks, saveBlock, removeBlock } = useTimeBlocks();
  const toast = useToast();

  const [tab, setTab] = useState<"upcoming" | "day">("upcoming");

  // Shared semester-wide task pool (Upcoming filters it; Day filters by date).
  const [allSemesterTasks, setAllSemesterTasks] = useState<HomeworkEntry[]>([]);

  // Modal state.
  const [editTask, setEditTask] = useState<HomeworkEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tbModalOpen, setTbModalOpen] = useState(false);
  const [tbInitial, setTbInitial] = useState<Partial<TimeBlock> | null>(null);

  // Prefilled times for HomeworkModal when creating from a Day-view slot.
  const [hwPrefillStart, setHwPrefillStart] = useState<string | null>(null);
  const [hwPrefillEnd, setHwPrefillEnd] = useState<string | null>(null);
  const [hwPrefillDate, setHwPrefillDate] = useState<string | null>(null);

  // Day-tab selected date.
  const [dayDate, setDayDate] = useState<string>(() => toIso(new Date()));

  const sources = useMemo(() => {
    const out: { year: number; semester: string; course: string }[] = [];
    if (selectedYear !== null && selectedSemester) {
      const y = years.find((yy) => yy.year === selectedYear);
      const s = y?.semesters.find((ss) => ss.name === selectedSemester);
      s?.courses.forEach((c) =>
        out.push({ year: selectedYear, semester: selectedSemester, course: c.name })
      );
    }
    return out;
  }, [years, selectedYear, selectedSemester]);

  // Suppress the next Firestore refetch triggered by our own optimistic write,
  // so the drag-updated times don't snap back to stale server data.
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const [lists, reminders] = await Promise.all([
        Promise.all(sources.map((s) => getCourseTasks(s.year, s.semester, s.course))),
        selectedYear !== null && selectedSemester
          ? getCourseTasks(selectedYear, selectedSemester, "reminders")
          : Promise.resolve([] as HomeworkEntry[]),
      ]);
      if (cancelled) return;
      setAllSemesterTasks([...lists.flat(), ...reminders]);
    })();
    return () => {
      cancelled = true;
    };
  }, [sources, getCourseTasks, homework, selectedYear, selectedSemester]);

  // Upcoming items derived from the shared pool.
  const upcomingItems = useMemo(() => {
    const now = startOfDay(new Date());
    const horizon = new Date(now.getTime() + 14 * 86400000);
    return allSemesterTasks
      .filter((t) => t.status === "PENDING")
      // Drop tasks whose due moment has already passed — they belong in overdue,
      // not upcoming.
      .filter((t) => !isOverdue(t.dueDate, t.endTime ?? t.startTime))
      .filter((t) => {
        const d = startOfDay(new Date(t.dueDate));
        return d >= now && d <= horizon;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allSemesterTasks]);

  // Listen for "open this day in sidebar" requests from calendar widgets.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (!detail?.date) return;
      setTab("day");
      setDayDate(detail.date);
    };
    window.addEventListener("oplanner:select-day", onPick);
    return () => window.removeEventListener("oplanner:select-day", onPick);
  }, []);

  // Task accent: per-task color → course color → deterministic fallback.
  const colorForTask = (t: HomeworkEntry): string => {
    if (t.color) return t.color;
    if (t.course === "reminders") return "#7c4dff";
    const y = years.find((yr) => yr.year === t.year);
    const s = y?.semesters.find((ss) => ss.name === t.semester || ss.key === t.semester);
    const c = s?.courses.find((cc) => cc.name === t.course);
    return courseColor(t.course, c?.color);
  };

  // Block color: course-bound → course color; else user-picked; else default.
  const colorForBlock = (b: TimeBlock): string => {
    if (!b.courseId) return b.color ?? "#7c4dff";
    if (selectedYear === null || !selectedSemester) return b.color ?? "#7c4dff";
    const y = years.find((yr) => yr.year === selectedYear);
    const s = y?.semesters.find((ss) => ss.name === selectedSemester || ss.key === selectedSemester);
    const c = s?.courses.find((cc) => cc.name === b.courseId);
    return courseColor(b.courseId, c?.color);
  };

  const dayTasks = useMemo(
    () => allSemesterTasks.filter((t) => t.dueDate === dayDate),
    [allSemesterTasks, dayDate]
  );
  const dayBlocks = useMemo(
    () => blocks.filter((b) => b.date === dayDate),
    [blocks, dayDate]
  );

  const handleTaskClick = (t: HomeworkEntry) => {
    setEditTask(t);
    setModalOpen(true);
  };

  const handleBlockClick = (b: TimeBlock) => {
    setTbInitial(b);
    setTbModalOpen(true);
  };

  const handleSlotDblClick = ({ date, start, end }: { date: string; start: string; end: string }) => {
    setHwPrefillDate(date);
    setHwPrefillStart(start);
    setHwPrefillEnd(end);
    setEditTask(null);
    setModalOpen(true);
  };

  return (
    <aside className={`rs ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="rs-glow" aria-hidden />

      <div className="rs-tabs" role="tablist" data-active={tab}>
        <button
          role="tab"
          aria-selected={tab === "upcoming"}
          className={`rs-tab ${tab === "upcoming" ? "rs-tab-active" : ""}`}
          onClick={() => setTab("upcoming")}
        >
          Upcoming
        </button>
        <button
          role="tab"
          aria-selected={tab === "day"}
          className={`rs-tab ${tab === "day" ? "rs-tab-active" : ""}`}
          onClick={() => setTab("day")}
        >
          Day
        </button>
        <span className="rs-tab-indicator" aria-hidden />
      </div>

      {tab === "upcoming" && (
        <UpcomingPanel items={upcomingItems} onItemClick={handleTaskClick} />
      )}

      {tab === "day" && (
        <DayPanel
          dayDate={dayDate}
          onChangeDayDate={setDayDate}
          dayTasks={dayTasks}
          dayBlocks={dayBlocks}
          colorForTask={colorForTask}
          colorForBlock={colorForBlock}
          onTaskClick={handleTaskClick}
          onBlockClick={handleBlockClick}
          onSlotDblClick={handleSlotDblClick}
          onCommitTaskDrag={({ task, newStart, newEnd }) => {
            skipNextFetchRef.current = true;
            setAllSemesterTasks((prev) =>
              prev.map((x) =>
                x.id === task.id ? { ...x, startTime: newStart, endTime: newEnd } : x
              )
            );
            void addHomework(
              task.id,
              task.name,
              task.dueDate,
              task.status,
              task.year,
              task.semester,
              task.course,
              task.ignoreOverdue,
              undefined,
              newStart,
              newEnd
            );
          }}
          onCommitBlockDrag={({ block, newStart, newEnd }) => {
            void saveBlock({ ...block, startTime: newStart, endTime: newEnd });
          }}
        />
      )}

      {modalOpen && (
        <Suspense fallback={null}>
      <HomeworkModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTask(null);
          setHwPrefillDate(null);
          setHwPrefillStart(null);
          setHwPrefillEnd(null);
        }}
        onSave={async (id, name, dueDate, status, year, semester, course, ignoreOverdue, startTime, endTime, notes, color) => {
          const prevLocation = id && editTask
            ? { year: editTask.year, semester: editTask.semester, course: editTask.course }
            : undefined;
          await addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue, prevLocation, startTime, endTime, notes, color);
          setModalOpen(false);
          setEditTask(null);
          setHwPrefillDate(null);
          setHwPrefillStart(null);
          setHwPrefillEnd(null);
          toast.success(id ? `Task “${name}” updated` : `Task “${name}” added`);
        }}
        editHomework={editTask}
        onDelete={editTask ? async () => {
          const name = editTask.name;
          await removeHomework(editTask.id, editTask.year, editTask.semester, editTask.course);
          setAllSemesterTasks((prev) => prev.filter((x) => x.id !== editTask.id));
          toast.success(`Deleted “${name}”`);
        } : undefined}
        selectedCourseData={
          editTask
            ? { year: editTask.year, semester: editTask.semester, course: selectedCourse ?? undefined }
            : selectedYear !== null && selectedSemester
              ? { year: selectedYear, semester: selectedSemester, course: selectedCourse ?? undefined }
              : null
        }
        prefilledDueDate={hwPrefillDate}
        prefilledStartTime={hwPrefillStart}
        prefilledEndTime={hwPrefillEnd}
        isLoading={false}
        availableCourses={
          selectedYear !== null && selectedSemester
            ? (years
                .find((y) => y.year === (editTask?.year ?? selectedYear))
                ?.semesters.find((s) => s.name === (editTask?.semester ?? selectedSemester) || s.key === (editTask?.semester ?? selectedSemester))
                ?.courses.map((c) => c.name) ?? [])
            : undefined
        }
      />
        </Suspense>
      )}

      {tbModalOpen && (
        <Suspense fallback={null}>
      <TimeBlockModal
        isOpen={tbModalOpen}
        onClose={() => {
          setTbModalOpen(false);
          setTbInitial(null);
        }}
        onSave={async (b) => {
          await saveBlock(b);
          toast.success(b.id ? "Time block updated" : "Time block added");
        }}
        onDelete={async (id) => {
          await removeBlock(id);
        }}
        initial={tbInitial}
        availableCourses={
          selectedCourse === null && selectedYear !== null && selectedSemester
            ? (years
                .find((y) => y.year === selectedYear)
                ?.semesters.find((s) => s.name === selectedSemester || s.key === selectedSemester)
                ?.courses.map((c) => c.name) ?? [])
            : undefined
        }
        defaultCourse={selectedCourse ?? undefined}
      />
        </Suspense>
      )}
    </aside>
  );
};

export default RightSidebar;
