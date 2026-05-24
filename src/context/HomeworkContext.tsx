import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db, requireUid, auth } from "../firebase";

export interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  year: number;
  semester: string;
  course: string;
  ignoreOverdue?: boolean;
}

interface Notification {
  id: string;
  message: string;
  style: React.CSSProperties; // Include style for days left
}

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
    ignoreOverdue?: boolean
  ) => Promise<void>;
  removeHomework: (
    id: string,
    year: number,
    semester: string,
    course: string
  ) => Promise<void>;
}

const HomeworkContext = createContext<HomeworkContextProps | undefined>(undefined);

export const HomeworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const cacheKey = (year: number, semester: string, course: string) => {
    const uid = requireUid();
    return `oplanner.homework.${uid}.${year}|${semester}|${course}`;
  };

  const fetchHomework = useCallback(async (
    year: number,
    semester: string,
    course: string,
    force = false
  ) => {
    await auth.authStateReady();
    let key: string;
    try {
      key = cacheKey(year, semester, course);
    } catch {
      return;
    }
    // Show cache immediately for fast paint, but always pull fresh from Firestore
    // afterwards so cross-device edits propagate.
    if (!force) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setHomework(parsed as HomeworkEntry[]);
          }
        }
      } catch {
        /* ignore */
      }
    }
    try {
      const tasksCollection = collection(
        db,
        `users/${requireUid()}/years/${year}/semesters/${semester}/courses/${course}/tasks`
      );
      const snapshot = await getDocs(tasksCollection);
      const homeworkList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        year,
        semester,
        course,
      })) as HomeworkEntry[];

      setHomework(homeworkList);
      try {
        localStorage.setItem(key, JSON.stringify(homeworkList));
      } catch {
        /* quota */
      }
    } catch (error) {
      console.error("Error fetching homework:", error);
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
    try {
      key = cacheKey(year, semester, course);
    } catch {
      return [];
    }
    if (!force) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed as HomeworkEntry[];
        }
      } catch {
        /* ignore */
      }
    }
    try {
      const tasksCollection = collection(
        db,
        `users/${requireUid()}/years/${year}/semesters/${semester}/courses/${course}/tasks`
      );
      const snapshot = await getDocs(tasksCollection);
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        year,
        semester,
        course,
      })) as HomeworkEntry[];
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        /* quota */
      }
      return list;
    } catch (e) {
      console.error("Error fetching course tasks:", e);
      return [];
    }
  }, []);

  const writeCache = (year: number, semester: string, course: string, list: HomeworkEntry[]) => {
    try {
      localStorage.setItem(cacheKey(year, semester, course), JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };


  // Get style for days left
  const getDayStyle = (daysLeft: number): React.CSSProperties => {
    if (daysLeft <= 0) {
      return { color: "#ff4c4c", fontWeight: "bold" }; // Bold red for overdue
    } else if (daysLeft < 3) {
      return { color: "orange", fontWeight: "bold" }; // Orange for near-due
    } else {
      return { color: "#2ECC71", fontWeight: "bold" }; // Green for sufficient time
    }
  };

  // Calculate notifications
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
        style: { color: "red", fontWeight: "bold" },
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

  // Add or update homework
  const addHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string,
    ignoreOverdue: boolean = false
  ) => {
    try {
      const tasksCollection = collection(
        db,
        `users/${requireUid()}/years/${year}/semesters/${semester}/courses/${course}/tasks`
      );

      if (id) {
        const prevEntry = homework.find((h) => h.id === id);
        const movedLocation =
          !!prevEntry &&
          (prevEntry.course !== course ||
            prevEntry.year !== year ||
            prevEntry.semester !== semester);
        if (movedLocation && prevEntry) {
          try {
            await deleteDoc(
              doc(
                db,
                `users/${requireUid()}/years/${prevEntry.year}/semesters/${prevEntry.semester}/courses/${prevEntry.course}/tasks`,
                id
              )
            );
          } catch (e) {
            console.error("Error deleting old task location:", e);
          }
        }

        const taskDoc = doc(tasksCollection, id);
        const task = { id, name, dueDate, status, year, semester, course, ignoreOverdue };
        await setDoc(taskDoc, task, { merge: true });

        setHomework((prev) => {
          const exists = prev.some((entry) => entry.id === id);
          const next = exists
            ? prev.map((entry) =>
                entry.id === id
                  ? { ...entry, name, dueDate, status, year, semester, course, ignoreOverdue }
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
        const newTaskRef = doc(tasksCollection);
        const newTask = {
          id: newTaskRef.id,
          name,
          dueDate,
          status,
          year,
          semester,
          course,
          ignoreOverdue,
        };
        await setDoc(newTaskRef, newTask);

        setHomework((prev) => {
          const next = [...prev, newTask];
          writeCache(year, semester, course, next.filter((h) => h.course === course));
          return next;
        });
      }
    } catch (error) {
      console.error("Error adding/updating homework:", error);
    }
  };

  // Remove homework
  const removeHomework = async (
    id: string,
    year: number,
    semester: string,
    course: string
  ) => {
    const previousHomework = [...homework];
    try {
      setHomework((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        writeCache(year, semester, course, next.filter((h) => h.course === course));
        return next;
      });
      const taskDoc = doc(
        db,
        `users/${requireUid()}/years/${year}/semesters/${semester}/courses/${course}/tasks`,
        id
      );
      await deleteDoc(taskDoc);
    } catch (error) {
      console.error("Error removing homework:", error);
      setHomework(previousHomework); // Revert state on error
    }
  };

  return (
    <HomeworkContext.Provider
      value={{
        homework,
        notifications,
        fetchHomework,
        getCourseTasks,
        addHomework,
        removeHomework,
      }}
    >
      {children}
    </HomeworkContext.Provider>
  );
};

export const useHomework = () => {
  const context = useContext(HomeworkContext);
  if (!context) {
    throw new Error("useHomework must be used within a HomeworkProvider");
  }
  return context;
};
