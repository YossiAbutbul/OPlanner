import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "../hooks/useLocalStorageCache";
import {
  createTaskRef,
  deleteTask,
  fetchCourseTasks,
  saveTask,
} from "../services/homework";
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
}

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
      if (entry.ignoreOverdue) return false;
      return entry.dueDate < todayStr && entry.status === "PENDING";
    });

    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const upcoming = homework
      .filter((entry) => entry.dueDate >= todayStr && entry.dueDate <= cutoffStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    setNotifications([
      ...overdue.map((entry) => ({
        id: entry.id,
        message: `${entry.name} is overdue!`,
        style: { color: "red", fontWeight: "bold" } as React.CSSProperties,
      })),
      ...upcoming.map((entry) => {
        const [yy, mm, dd] = entry.dueDate.split("-").map(Number);
        const dueLocal = new Date(yy, (mm || 1) - 1, dd || 1);
        const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysLeft = Math.round((dueLocal.getTime() - todayLocal.getTime()) / 86400000);
        return {
          id: entry.id,
          message: `${entry.name} is due in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
          style: getDayStyle(daysLeft),
        };
      }),
    ]);
  }, [homework]);

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
    try {
      const uid = requireUid();

      if (id) {
        const prevEntry: { year: number; semester: string; course: string } | undefined =
          prevLocation ?? homework.find((h) => h.id === id);
        const movedLocation =
          !!prevEntry &&
          (prevEntry.course !== course ||
            prevEntry.year !== year ||
            prevEntry.semester !== semester);
        if (movedLocation && prevEntry) {
          try {
            await deleteTask(uid, prevEntry.year, prevEntry.semester, prevEntry.course, id);
          } catch (e) {
            console.error("Error deleting old task location:", e);
          }
        }

        const task: HomeworkEntry = {
          id, name, dueDate, status, year, semester, course, ignoreOverdue,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(color !== undefined ? { color } : {}),
        };
        await saveTask(uid, task);

        setHomework((prev) => {
          const exists = prev.some((entry) => entry.id === id);
          const next = exists
            ? prev.map((entry) =>
                entry.id === id
                  ? { ...entry, name, dueDate, status, year, semester, course, ignoreOverdue, startTime, endTime, notes, color }
                  : entry
              )
            : [...prev, task];
          if (movedLocation && prevEntry) {
            writeCache(
              prevEntry.year,
              prevEntry.semester,
              prevEntry.course,
              next.filter(
                (h) =>
                  h.course === prevEntry.course &&
                  h.year === prevEntry.year &&
                  h.semester === prevEntry.semester
              )
            );
          }
          writeCache(
            year,
            semester,
            course,
            next.filter(
              (h) => h.course === course && h.year === year && h.semester === semester
            )
          );
          return next;
        });
      } else {
        const newRef = createTaskRef(uid, year, semester, course);
        const newTask: HomeworkEntry = {
          id: newRef.id,
          name,
          dueDate,
          status,
          year,
          semester,
          course,
          ignoreOverdue,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(color !== undefined ? { color } : {}),
        };
        await saveTask(uid, newTask);

        setHomework((prev) => {
          const next = [...prev, newTask];
          writeCache(year, semester, course, next.filter((h) => h.course === course));
          return next;
        });
      }
    } catch (error) {
      console.error("Error adding/updating homework:", error);
    }
  }, [homework, writeCache]);

  const removeHomework = useCallback(async (
    id: string,
    year: number,
    semester: string,
    course: string
  ) => {
    const previous = homework;
    try {
      setHomework((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        writeCache(year, semester, course, next.filter((h) => h.course === course));
        return next;
      });
      await deleteTask(requireUid(), year, semester, course, id);
    } catch (error) {
      console.error("Error removing homework:", error);
      setHomework(previous);
    }
  }, [homework, writeCache]);

  const value = useMemo<HomeworkContextProps>(
    () => ({ homework, notifications, fetchHomework, getCourseTasks, addHomework, removeHomework }),
    [homework, notifications, fetchHomework, getCourseTasks, addHomework, removeHomework]
  );

  return <HomeworkContext.Provider value={value}>{children}</HomeworkContext.Provider>;
};

export const useHomework = () => {
  const ctx = useContext(HomeworkContext);
  if (!ctx) throw new Error("useHomework must be used within a HomeworkProvider");
  return ctx;
};
