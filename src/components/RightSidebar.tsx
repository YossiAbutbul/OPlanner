import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useTimeBlocks } from "../context/TimeBlockContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { fetchAgentEnabled, type AgentProposal } from "../services/agent";

// Heavy form modals — only mounted when the user actually opens them, so
// their chunks fetch on first interaction instead of in the initial bundle.
const HomeworkModal = lazy(() => import("./HomeworkModal"));
const TimeBlockModal = lazy(() => import("./TimeBlockModal"));
import AgentPanel from "./RightSidebar/AgentPanel";
import DayPanel from "./RightSidebar/DayPanel";
import RemindersModal from "./RemindersModal";
import { courseColor } from "../utility/courseColor";
import { toIso } from "../utility/dayCalendar";
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
  const { getCourseTasks, addHomework, removeHomework, homework, applyEdits } = useHomework();
  const { blocks, saveBlock, removeBlock } = useTimeBlocks();
  const toast = useToast();
  const { user } = useAuth();

  // Day opens first: today's schedule is the most-used view.
  const [tab, setTab] = useState<"day" | "agent">("day");

  // The Agent tab shows only for accounts the server allows (api/agent.ts).
  // The dev server has no /api, so show it there to work on the UI.
  const [agentEnabled, setAgentEnabled] = useState(import.meta.env.DEV);
  useEffect(() => {
    if (!user || import.meta.env.DEV) return;
    let cancelled = false;
    void fetchAgentEnabled().then((ok) => {
      if (!cancelled) setAgentEnabled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Shared semester-wide task pool (Day filters it by date).
  // Fetched from Firestore; optimistic edits are layered on below.
  const [fetchedSemesterTasks, setAllSemesterTasks] = useState<HomeworkEntry[]>([]);

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

  // "All reminders" modal (opened from the sidebar bell via a window event).
  const [remindersOpen, setRemindersOpen] = useState(false);
  // When adding from that modal, default the HomeworkModal's course to reminders.
  const [addingReminder, setAddingReminder] = useState(false);

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

  // Pending saves show here at once instead of after the Firestore round trip.
  const allSemesterTasks = useMemo(() => {
    const names = new Set(sources.map((s) => s.course));
    return applyEdits(
      fetchedSemesterTasks,
      (t) => t.year === selectedYear && (names.has(t.course) || t.course === "reminders")
    );
  }, [fetchedSemesterTasks, applyEdits, sources, selectedYear]);

  const reminders = useMemo(
    () => allSemesterTasks.filter((t) => t.course === "reminders"),
    [allSemesterTasks]
  );

  // Suppress the next Firestore refetch triggered by our own optimistic write,
  // so the drag-updated times don't snap back to stale server data.
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    // Saved copy first (instant on reload), then the server.
    const load = async (force: boolean) => {
      const [lists, reminders] = await Promise.all([
        Promise.all(sources.map((s) => getCourseTasks(s.year, s.semester, s.course, force))),
        selectedYear !== null && selectedSemester
          ? getCourseTasks(selectedYear, selectedSemester, "reminders", force)
          : Promise.resolve([] as HomeworkEntry[]),
      ]);
      if (cancelled) return;
      setAllSemesterTasks([...lists.flat(), ...reminders]);
    };
    (async () => {
      await load(false);
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sources, getCourseTasks, homework, selectedYear, selectedSemester]);

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

  // Sidebar "All reminders" button asks us to open the reminders modal.
  useEffect(() => {
    const onOpen = () => setRemindersOpen(true);
    window.addEventListener("oplanner:open-reminders", onOpen);
    return () => window.removeEventListener("oplanner:open-reminders", onOpen);
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

  // Saves a change the agent proposed, once the user confirms it. Edits keep
  // the fields the agent can't see (notes, color, ignoreOverdue).
  const confirmProposal = async (p: AgentProposal, year: number, semester: string) => {
    const fromCourse = p.prevCourse ?? p.course;
    const existing = p.id
      ? allSemesterTasks.find((t) => t.id === p.id && t.course === fromCourse && t.year === year)
      : undefined;
    // Never let a proposal create a task under an id the user doesn't have.
    if (p.id && !existing) {
      toast.error(`“${p.name}” no longer exists`);
      throw new Error("Proposed task not found");
    }
    try {
      await addHomework(
        p.id ?? null,
        p.name,
        p.dueDate,
        p.status,
        year,
        semester,
        p.course,
        existing?.ignoreOverdue,
        p.id ? { year, semester, course: fromCourse } : undefined,
        p.startTime,
        p.endTime,
        existing?.notes,
        existing?.color
      );
    } catch (e) {
      toast.error(`Couldn't save “${p.name}”`);
      throw e;
    }
    toast.success(p.id ? `Task “${p.name}” updated` : `Task “${p.name}” added`);
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

      {agentEnabled && (
        <div className="rs-tabs" role="tablist" data-active={tab}>
          <button
            role="tab"
            aria-selected={tab === "day"}
            className={`rs-tab ${tab === "day" ? "rs-tab-active" : ""}`}
            onClick={() => setTab("day")}
          >
            Schedule
          </button>
          <button
            role="tab"
            aria-selected={tab === "agent"}
            className={`rs-tab ${tab === "agent" ? "rs-tab-active" : ""}`}
            onClick={() => setTab("agent")}
          >
            Assistant
          </button>
          <span className="rs-tab-indicator" aria-hidden />
        </div>
      )}

      {/* Stays mounted while hidden so the conversation survives tab switches. */}
      {agentEnabled && (
        <div className="rs-agent-wrap" hidden={tab !== "agent"}>
          <AgentPanel
            key={user?.uid ?? "signed-out"}
            year={selectedYear}
            semester={selectedSemester}
            onConfirm={confirmProposal}
            storageKey={user ? `oplanner.agentChat.${user.uid}` : undefined}
            onCleared={(undo) => toast.info("Chat cleared", { action: { label: "Undo", onClick: undo } })}
          />
        </div>
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
          setAddingReminder(false);
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
          setAddingReminder(false);
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
              ? {
                  year: selectedYear,
                  semester: selectedSemester,
                  course: addingReminder ? "reminders" : selectedCourse ?? undefined,
                }
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

      <RemindersModal
        isOpen={remindersOpen}
        reminders={reminders}
        onClose={() => setRemindersOpen(false)}
        onEdit={(t) => {
          setRemindersOpen(false);
          handleTaskClick(t);
        }}
        onDelete={async (t) => {
          await removeHomework(t.id, t.year, t.semester, t.course);
          setAllSemesterTasks((prev) => prev.filter((x) => x.id !== t.id));
          toast.success(`Deleted “${t.name}”`);
        }}
        onAdd={() => {
          setRemindersOpen(false);
          setEditTask(null);
          setAddingReminder(true);
          setModalOpen(true);
        }}
      />

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
