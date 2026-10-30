import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useTimeBlocks } from "../context/TimeBlockContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { requireUid } from "../firebase";
import { createTaskRef } from "../services/homework";
import { fetchAgentAccess, type AgentAccess, type AgentProposal } from "../services/agent";
import { lsCache } from "../hooks/useLocalStorageCache";
import { updateCourseMeta } from "../hooks/useCourseMeta";
import { applyWeights, withAutoExam } from "../utility/gradeSheet";

// Heavy form modals — only mounted when the user actually opens them, so
// their chunks fetch on first interaction instead of in the initial bundle.
const HomeworkModal = lazy(() => import("./HomeworkModal"));
const TimeBlockModal = lazy(() => import("./TimeBlockModal"));
import AgentPanel from "./RightSidebar/AgentPanel";
import WaitlistPanel from "./RightSidebar/WaitlistPanel";
import DayPanel from "./RightSidebar/DayPanel";
import RemindersModal from "./RemindersModal";
import { courseColor } from "../utility/courseColor";
import { blockCourseName, toIso } from "../utility/dayCalendar";
import type { HomeworkEntry, TimeBlock, YearTreeData } from "../types/models";
import "../css/RightSidebar.css";

interface RightSidebarProps {
  years: YearTreeData[];
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
  mobileOpen?: boolean;
  // Adds a course the assistant proposed, the way Add course does.
  onAddCourse?: (year: number, semesterKey: string, name: string, finalDate?: string) => Promise<void>;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  years,
  selectedYear,
  selectedSemester,
  selectedCourse,
  mobileOpen = false,
  onAddCourse,
}) => {
  const { getCourseTasks, addHomework, removeHomework, homework, applyEdits } = useHomework();
  const { blocks, saveBlock, removeBlock } = useTimeBlocks();
  const toast = useToast();
  const { user } = useAuth();

  // Day opens first: today's schedule is the most-used view.
  // The Assistant opens first; Schedule is one tap away.
  const [tab, setTab] = useState<"day" | "agent">("agent");

  // Who may use the assistant is decided by the server (api/agent.ts). The
  // last answer is kept per user, so after a reload the Assistant tab shows
  // the right thing at once instead of waiting for the request. The dev
  // server has no /api, so the assistant is on there to work on the UI.
  const accessKey = user ? `oplanner.agentAccess.${user.uid}` : null;
  const [access, setAccess] = useState<AgentAccess | null>(() =>
    import.meta.env.DEV ? { enabled: true, waitlisted: false } : accessKey ? lsCache.read<AgentAccess>(accessKey) : null
  );
  useEffect(() => {
    if (!accessKey || import.meta.env.DEV) return;
    setAccess(lsCache.read<AgentAccess>(accessKey));
    let cancelled = false;
    void fetchAgentAccess().then((next) => {
      if (cancelled || !next) return;
      setAccess(next);
      lsCache.write(accessKey, next);
    });
    return () => {
      cancelled = true;
    };
  }, [accessKey]);
  const markWaitlisted = () => {
    const next = { enabled: false, waitlisted: true };
    setAccess(next);
    if (accessKey) lsCache.write(accessKey, next);
  };

  // Shared semester-wide task pool (Day filters it by date).
  // Fetched from Firestore; optimistic edits are layered on below.
  const [fetchedSemesterTasks, setAllSemesterTasks] = useState<HomeworkEntry[]>([]);
  // Which semester the pool above holds, once loaded ("year|semester").
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

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

  // Every other semester's courses and reminders, for the Schedule only: a
  // day is a day whatever semester its tasks belong to (summer courses,
  // overlapping terms). The Assistant and the overview stay per semester.
  const otherSources = useMemo(() => {
    const out: { year: number; semester: string; course: string }[] = [];
    for (const y of years) {
      for (const s of y.semesters) {
        if (y.year === selectedYear && s.name === selectedSemester) continue;
        for (const c of s.courses) out.push({ year: y.year, semester: s.name, course: c.name });
        out.push({ year: y.year, semester: s.name, course: "reminders" });
      }
    }
    return out;
  }, [years, selectedYear, selectedSemester]);
  const [fetchedOtherTasks, setFetchedOtherTasks] = useState<HomeworkEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (force: boolean) => {
      const lists = await Promise.all(
        otherSources.map((s) =>
          getCourseTasks(s.year, s.semester, s.course, force).then((list) =>
            // A task's own fields don't always name its semester; set it from
            // where it was read.
            list.map((t) => ({ ...t, year: s.year, semester: s.semester }))
          )
        )
      );
      if (!cancelled) setFetchedOtherTasks(lists.flat());
    };
    (async () => {
      await load(false);
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [otherSources, getCourseTasks, homework]);

  const otherTasks = useMemo(() => {
    const where = new Set(otherSources.map((s) => `${s.year}|${s.semester}|${s.course}`));
    return applyEdits(fetchedOtherTasks, (t) => where.has(`${t.year}|${t.semester}|${t.course}`));
  }, [fetchedOtherTasks, applyEdits, otherSources]);

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
      setLoadedFor(`${selectedYear}|${selectedSemester}`);
    };
    (async () => {
      await load(false);
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sources, getCourseTasks, homework, selectedYear, selectedSemester]);

  // Calendar widgets pick the day the Schedule tab shows. The open tab stays
  // as it is, so clicking a day doesn't pull you out of the Assistant.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (!detail?.date) return;
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
    const name = blockCourseName(b.courseId)!;
    const c = s?.courses.find((cc) => cc.name === name);
    return courseColor(name, c?.color);
  };

  // "Semester B" (or "2027 · Semester A" for another year) on a task from
  // outside the open semester; null for the open one's.
  const openKeys = useMemo(
    () => new Set(allSemesterTasks.map((t) => `${t.year}|${t.course}|${t.id}`)),
    [allSemesterTasks]
  );
  const otherSemesterLabel = (t: HomeworkEntry): string | null => {
    if (openKeys.has(`${t.year}|${t.course}|${t.id}`)) return null;
    return t.year === selectedYear ? t.semester : `${t.year} · ${t.semester}`;
  };

  const dayTasks = useMemo(() => {
    const open = allSemesterTasks.filter((t) => t.dueDate === dayDate);
    const seen = new Set(open.map((t) => `${t.year}|${t.course}|${t.id}`));
    return [
      ...open,
      ...otherTasks.filter((t) => t.dueDate === dayDate && !seen.has(`${t.year}|${t.course}|${t.id}`)),
    ];
  }, [allSemesterTasks, otherTasks, dayDate]);
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
  // Resolves with the saved task's id, so the card can follow the task.
  const confirmProposal = async (p: AgentProposal, year: number, semester: string): Promise<string | void> => {
    // A study session goes into the Schedule, not the task list.
    // A planned study session is a task like any other: in its course (or
    // a reminder when it isn't about one), with the session's times, so it
    // shows in Up next, the calendar and the course's list.
    if (p.action === "block") {
      if (!p.startTime || !p.endTime) throw new Error("A study session needs a start and end time.");
      const course = p.course || "reminders";
      const id = createTaskRef(requireUid(), year, semester, course).id;
      try {
        // Flagged as the Assistant's own plan, so it doesn't plan for it again.
        await addHomework(id, p.name, p.dueDate, "PENDING", year, semester, course, false, undefined, p.startTime, p.endTime, undefined, undefined, true);
      } catch (e) {
        toast.error(`Couldn't add “${p.name}”`);
        throw e;
      }
      toast.success(`Task “${p.name}” added`);
      return id;
    }
    if (p.action === "grades") {
      const key =
        years
          .find((y) => y.year === year)
          ?.semesters.find((s) => s.name === semester || s.key === semester)?.key ?? semester;
      try {
        await updateCourseMeta({ year, semester: key, course: p.course }, (meta) => ({
          gradeItems: withAutoExam(
            applyWeights(meta.gradeItems, p.weights ?? [], () => crypto.randomUUID()),
            meta.gradeCap
          ),
        }));
      } catch (e) {
        toast.error(`Couldn't save the weights for “${p.course}”`);
        throw e;
      }
      toast.success(`Weights saved for “${p.course}”`);
      return;
    }
    if (p.action === "course") {
      const key =
        years
          .find((y) => y.year === year)
          ?.semesters.find((s) => s.name === semester || s.key === semester)?.key ?? semester;
      const name = p.name.trim();
      try {
        if (!onAddCourse) throw new Error("Adding courses isn't available here");
        await onAddCourse(year, key, name, p.dueDate || undefined);
      } catch (e) {
        toast.error(`Couldn't add “${name}”`);
        throw e;
      }
      toast.success(`Course “${name}” added`);
      return;
    }
    const fromCourse = p.prevCourse ?? p.course;
    const existing = p.id
      ? allSemesterTasks.find(
          (t) => t.id === p.id && t.course === fromCourse && t.year === year && t.semester === semester
        )
      : undefined;
    // Never let a proposal create a task under an id the user doesn't have.
    if (p.id && !existing) {
      toast.error(`“${p.name}” no longer exists`);
      throw new Error("Proposed task not found");
    }
    if (p.action === "delete" && existing) {
      try {
        await removeHomework(existing.id, existing.year, existing.semester, existing.course);
      } catch (e) {
        toast.error(`Couldn't delete “${p.name}”`);
        throw e;
      }
      setAllSemesterTasks((prev) => prev.filter((x) => x.id !== existing.id));
      toast.success(`Deleted “${p.name}”`);
      return;
    }
    let taskId: string;
    try {
      // A new task gets its id up front so the card can track it.
      taskId = p.id ?? createTaskRef(requireUid(), year, semester, p.course).id;
      await addHomework(
        taskId,
        p.name,
        p.dueDate,
        // The Assistant says DONE; the planner stores COMPLETED.
        p.status === "DONE" ? "COMPLETED" : "PENDING",
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
    return taskId;
  };

  const handleSlotDblClick = ({ date, start, end }: { date: string; start: string; end: string }) => {
    setHwPrefillDate(date);
    setHwPrefillStart(start);
    setHwPrefillEnd(end);
    setEditTask(null);
    setModalOpen(true);
  };

  return (
    <aside className={`rs ${mobileOpen ? "mobile-open" : ""}${tab === "agent" ? " rs-assistant" : ""}`}>
      <div className="rs-glow" aria-hidden />

      {user && (
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
            AI Assistant
          </button>
          <span className="rs-tab-indicator" aria-hidden />
        </div>
      )}

      {/* Stays mounted while hidden so the conversation survives tab switches.
          While access is still unknown (first visit), the tab stays empty. */}
      {user && (
        <div className="rs-agent-wrap" hidden={tab !== "agent"}>
          {access && !access.enabled && <WaitlistPanel waitlisted={access.waitlisted} onJoined={markWaitlisted} />}
          {access?.enabled && (
            <AgentPanel
              key={user.uid}
              uid={user.uid}
              year={selectedYear}
              semester={selectedSemester}
              onConfirm={confirmProposal}
              liveTasks={
                selectedYear !== null && selectedSemester && loadedFor === `${selectedYear}|${selectedSemester}`
                  ? { year: selectedYear, semester: selectedSemester, tasks: allSemesterTasks }
                  : undefined
              }
              storageKey={`oplanner.agentChat.${user.uid}`}
              blocks={blocks}
              onCleared={(undo) => toast.info("Chat cleared", { action: { label: "Undo", onClick: undo } })}
            />
          )}
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
          otherSemesterLabel={otherSemesterLabel}
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
        note={editTask && otherSemesterLabel(editTask) ? `From another semester: ${otherSemesterLabel(editTask)}` : null}
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
