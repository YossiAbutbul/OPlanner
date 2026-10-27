import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "../hooks/useLocalStorageCache";
import {
  createTaskRef,
  deleteTask,
  fetchCourseTasks,
  FINAL_DATE_EVENT,
  FINAL_TASK_ID,
  saveCourseFinalDate,
  saveTask,
  type FinalDateDetail,
} from "../services/homework";
import { isOverdue, timeLeft } from "../utility/dayCalendar";
import { useToast } from "./ToastContext";
import type { HomeworkEntry, Notification } from "../types/models";

// Re-export so existing imports keep working.
export type { HomeworkEntry } from "../types/models";

interface HomeworkContextProps {
  homework: HomeworkEntry[];
  notifications: Notification[];
  fetchHomework: (year: number, semester: string, course: string, force?: boolean) => Promise<void>;
  getCourseTasks: (year: number, semester: string, course: string, force?: boolean) => Promise<HomeworkEntry[]>;
  addHomework: (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string,
    ignoreOverdue?: boolean,
    prevLocation?: { year: number; semester: string; course: string },
    startTime?: string,
    endTime?: string,
    notes?: string,
    color?: string
  ) => Promise<void>;
  removeHomework: (
    id: string,
    year: number,
    semester: string,
    course: string
  ) => Promise<void>;
  /**
   * Overlay this session's optimistic edits on a list fetched from
   * Firestore: edited tasks are replaced, deleted ones dropped, new ones
   * added when `inScope` accepts them. Changes identity whenever an edit
   * lands or is rolled back, so it works as a memo/effect dependency.
   */
  applyEdits: (list: HomeworkEntry[], inScope: (t: HomeworkEntry) => boolean) => HomeworkEntry[];
}

// One optimistic change: the task as it should now look, or null if deleted.
interface Edit {
  entry: HomeworkEntry | null;
  seq: number;
}

// Task ids are only unique within a course (every course's Final Exam task
// is "final-exam"), so edits are keyed by year + course + id. The semester
// is left out because views address it by key or by display name.
const editKey = (t: { id: string; year: number; course: string }) =>
  `${t.year}|${t.course}|${t.id}`;

const HomeworkContext = createContext<HomeworkContextProps | undefined>(undefined);

const cacheKey = (year: number, semester: string, course: string) => {
  const uid = requireUid();
  return `oplanner.homework.${uid}.${year}|${semester}|${course}`;
};

const getDayStyle = (daysLeft: number): React.CSSProperties => {
  if (daysLeft <= 0) return { color: "#ff4c4c", fontWeight: "bold" };
  if (daysLeft < 3) return { color: "orange", fontWeight: "bold" };
  return { color: "#2ECC71", fontWeight: "bold" };
};

export const HomeworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const toast = useToast();

  // Optimistic edits: applied to the UI immediately, written to Firestore in
  // the background. Kept for the session (they match the server once the
  // write lands); a failed write removes its own edit, which rolls the UI
  // back, and shows an error toast.
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const seqRef = useRef(0);

  const recordEdit = useCallback((key: string, entry: HomeworkEntry | null) => {
    const seq = ++seqRef.current;
    setEdits((prev) => ({ ...prev, [key]: { entry, seq } }));
    return seq;
  }, []);

  // Undo one edit, unless a newer edit of the same task has replaced it.
  const dropEdit = useCallback((key: string, seq: number) => {
    setEdits((prev) => {
      if (prev[key]?.seq !== seq) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyEdits = useCallback(
    (list: HomeworkEntry[], inScope: (t: HomeworkEntry) => boolean) => {
      const keys = Object.keys(edits);
      if (keys.length === 0) return list;
      const touched = new Set(keys);
      const out = list.filter((t) => !touched.has(editKey(t)));
      for (const key of keys) {
        const e = edits[key].entry;
        if (e && inScope(e)) out.push(e);
      }
      return out;
    },
    [edits]
  );

  const fetchHomework = useCallback(async (
    year: number,
    semester: string,
    course: string,
    force = false
  ) => {
    await auth.authStateReady();
    let key: string;
    try { key = cacheKey(year, semester, course); } catch { return; }

    if (!force) {
      const cached = lsCache.read<HomeworkEntry[]>(key);
      if (Array.isArray(cached)) setHomework(cached);
    }

    try {
      const uid = requireUid();
      const list = await fetchCourseTasks(uid, year, semester, course);
      setHomework(list);
      lsCache.write(key, list);
    } catch (e) {
      console.error("Error fetching homework:", e);
      setHomework([]);
    }
  }, []);

  const getCourseTasks = useCallback(async (
    year: number,
    semester: string,
    course: string,
    force = true
  ): Promise<HomeworkEntry[]> => {
    await auth.authStateReady();
    let key: string;
    try { key = cacheKey(year, semester, course); } catch { return []; }

    if (!force) {
      const cached = lsCache.read<HomeworkEntry[]>(key);
      if (Array.isArray(cached)) return cached;
    }

    try {
      const list = await fetchCourseTasks(requireUid(), year, semester, course);
      lsCache.write(key, list);
      return list;
    } catch (e) {
      console.error("Error fetching course tasks:", e);
      return [];
    }
  }, []);

  const writeCache = useCallback((year: number, semester: string, course: string, list: HomeworkEntry[]) => {
    try { lsCache.write(cacheKey(year, semester, course), list); } catch { /* ignore */ }
  }, []);

  // Calculate notifications when homework changes
  useEffect(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const overdue = homework.filter((entry) => {
      if (entry.status !== "PENDING") return false;
      return isOverdue(entry.dueDate, entry.endTime ?? entry.startTime, now);
    });

    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const upcoming = homework
      .filter((entry) => entry.dueDate >= todayStr && entry.dueDate <= cutoffStr)
      // Past-due tasks are reported as overdue above, not upcoming.
      .filter((entry) => !isOverdue(entry.dueDate, entry.endTime ?? entry.startTime, now))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    setNotifications([
      ...overdue.map((entry) => ({
        id: entry.id,
        message: `${entry.name} is overdue!`,
        style: { color: "red", fontWeight: "bold" } as React.CSSProperties,
      })),
      ...upcoming.map((entry) => {
        // Same-day tasks with a time read in hours; otherwise days.
        const tl = timeLeft(entry.dueDate, entry.endTime ?? entry.startTime);
        return {
          id: entry.id,
          message: `${entry.name} is due ${tl.text}`,
          style: getDayStyle(tl.days),
        };
      }),
    ]);
  }, [homework]);

  // Rewrite the per-course cache for every location a change touched.
  const syncCache = useCallback(
    (list: HomeworkEntry[], locs: { year: number; semester: string; course: string }[]) => {
      for (const l of locs) {
        writeCache(
          l.year,
          l.semester,
          l.course,
          list.filter((h) => h.course === l.course && h.year === l.year && h.semester === l.semester)
        );
      }
    },
    [writeCache]
  );

  // Tell the year tree a course's final date changed (optimistically).
  const announceFinalDate = useCallback((detail: FinalDateDetail) => {
    window.dispatchEvent(new CustomEvent<FinalDateDetail>(FINAL_DATE_EVENT, { detail }));
  }, []);

  const failToast = useCallback(
    (what: string) => toast.error(`Couldn't save ${what}. Your change was undone.`),
    [toast]
  );

  // Optimistic: the task updates on screen (and in the local cache) right
  // away and the promise resolves at once; Firestore is written in the
  // background. If that write fails, the change is rolled back and an error
  // toast explains it.
  const addHomework = useCallback(async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string,
    ignoreOverdue: boolean = false,
    prevLocation?: { year: number; semester: string; course: string },
    startTime?: string,
    endTime?: string,
    notes?: string,
    color?: string
  ) => {
    let uid: string;
    try {
      uid = requireUid();
    } catch (error) {
      console.error("Error adding/updating homework:", error);
      return;
    }

    const taskId = id ?? createTaskRef(uid, year, semester, course).id;
    const task: HomeworkEntry = {
      id: taskId, name, dueDate, status, year, semester, course, ignoreOverdue,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(color !== undefined ? { color } : {}),
    };
    const isSame = (h: HomeworkEntry) =>
      h.id === id && (!prevLocation || (h.course === prevLocation.course && h.year === prevLocation.year));
    const previous = id ? homework.find(isSame) : undefined;
    const prevLoc: { year: number; semester: string; course: string } | undefined =
      id ? prevLocation ?? previous : undefined;
    const moved =
      !!prevLoc &&
      (prevLoc.course !== course || prevLoc.year !== year || prevLoc.semester !== semester);
    const locs = moved && prevLoc ? [prevLoc, { year, semester, course }] : [{ year, semester, course }];
    // The Final Exam task and the course's final date are one value: moving
    // the task's date moves the date in the Finals widget too.
    const finalDateChanged =
      taskId === FINAL_TASK_ID && (!previous || previous.dueDate !== dueDate);
    if (finalDateChanged) announceFinalDate({ year, semester, course, date: dueDate });

    // 1. Show it now. A move also blanks the old location.
    const key = editKey(task);
    const oldKey = moved && prevLoc ? editKey({ id: taskId, ...prevLoc }) : null;
    const seq = recordEdit(key, task);
    const oldSeq = oldKey ? recordEdit(oldKey, null) : 0;
    const matches = (entry: HomeworkEntry) =>
      entry.id === taskId &&
      entry.course === (prevLoc?.course ?? course) &&
      entry.year === (prevLoc?.year ?? year);
    setHomework((prev) => {
      const exists = prev.some(matches);
      const next = exists
        ? prev.map((entry) => (matches(entry) ? { ...entry, ...task, startTime, endTime, notes, color } : entry))
        : [...prev, task];
      syncCache(next, locs);
      return next;
    });

    // 2. Persist in the background; roll back on failure.
    void (async () => {
      try {
        if (moved && prevLoc) {
          try {
            await deleteTask(uid, prevLoc.year, prevLoc.semester, prevLoc.course, taskId);
          } catch (e) {
            console.error("Error deleting old task location:", e);
          }
        }
        await saveTask(uid, task);
        if (finalDateChanged) await saveCourseFinalDate(uid, year, semester, course, dueDate);
      } catch (error) {
        console.error("Error adding/updating homework:", error);
        dropEdit(key, seq);
        if (oldKey) dropEdit(oldKey, oldSeq);
        if (finalDateChanged) {
          announceFinalDate({ year, semester, course, date: previous?.dueDate ?? null });
        }
        setHomework((prev) => {
          const isNew = (entry: HomeworkEntry) =>
            entry.id === taskId && entry.course === course && entry.year === year;
          const next = previous
            ? prev.map((entry) => (isNew(entry) ? previous : entry))
            : prev.filter((entry) => !isNew(entry));
          syncCache(next, locs);
          return next;
        });
        failToast(`“${name}”`);
      }
    })();
  }, [homework, recordEdit, dropEdit, syncCache, failToast, announceFinalDate]);

  const removeHomework = useCallback(async (
    id: string,
    year: number,
    semester: string,
    course: string
  ) => {
    const matches = (h: HomeworkEntry) => h.id === id && h.course === course && h.year === year;
    const previous = homework.find(matches);
    const locs = [{ year, semester, course }];
    const isFinal = id === FINAL_TASK_ID;
    const key = editKey({ id, year, course });
    const seq = recordEdit(key, null);
    // Deleting the Final Exam task clears the course's final date.
    if (isFinal) announceFinalDate({ year, semester, course, date: null });
    setHomework((prev) => {
      const next = prev.filter((entry) => !matches(entry));
      syncCache(next, locs);
      return next;
    });

    void (async () => {
      try {
        await deleteTask(requireUid(), year, semester, course, id);
        if (isFinal) await saveCourseFinalDate(requireUid(), year, semester, course, null);
      } catch (error) {
        console.error("Error removing homework:", error);
        dropEdit(key, seq);
        if (isFinal && previous) {
          announceFinalDate({ year, semester, course, date: previous.dueDate });
        }
        if (previous) {
          setHomework((prev) => {
            const next = prev.some(matches) ? prev : [...prev, previous];
            syncCache(next, locs);
            return next;
          });
        }
        toast.error(`Couldn't delete ${previous ? `“${previous.name}”` : "the task"}. It was restored.`);
      }
    })();
  }, [homework, recordEdit, dropEdit, syncCache, toast, announceFinalDate]);

  const value = useMemo<HomeworkContextProps>(
    () => ({ homework, notifications, fetchHomework, getCourseTasks, addHomework, removeHomework, applyEdits }),
    [homework, notifications, fetchHomework, getCourseTasks, addHomework, removeHomework, applyEdits]
  );

  return <HomeworkContext.Provider value={value}>{children}</HomeworkContext.Provider>;
};

export const useHomework = () => {
  const ctx = useContext(HomeworkContext);
  if (!ctx) throw new Error("useHomework must be used within a HomeworkProvider");
  return ctx;
};
