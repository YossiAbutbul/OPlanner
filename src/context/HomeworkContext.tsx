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
    if (!force) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setHomework(parsed as HomeworkEntry[]);
            return;
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
    force = false
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
    const overdue = homework.filter((entry) => {
      if (entry.ignoreOverdue) return false;
      const dueDate = new Date(entry.dueDate);
      return dueDate < now && entry.status === "PENDING";
    });

    const upcoming = homework
      .filter((entry) => {
        const dueDate = new Date(entry.dueDate);
        return (
          dueDate >= now &&
          dueDate <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    setNotifications([
      ...overdue.map((entry) => ({
        id: entry.id,
        message: `${entry.name} is overdue!`,
        style: { color: "red", fontWeight: "bold" },
      })),
      ...upcoming.map((entry) => {
        const dueDate = new Date(entry.dueDate);
        const diffInTime = dueDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
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
        const taskDoc = doc(tasksCollection, id);
        await updateDoc(taskDoc, { name, dueDate, status, ignoreOverdue });

        setHomework((prev) => {
          const next = prev.map((entry) =>
            entry.id === id ? { ...entry, name, dueDate, status, ignoreOverdue } : entry
          );
          writeCache(year, semester, course, next.filter((h) => h.course === course));
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
