import React, { createContext, useContext, useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  year: number;
  semester: string;
  course: string;
}

interface Notification {
  id: string;
  message: string;
  style: React.CSSProperties; // Include style for days left
}

interface HomeworkContextProps {
  homework: HomeworkEntry[];
  notifications: Notification[];
  fetchHomework: (year: number, semester: string, course: string) => Promise<void>;
  addHomework: (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string
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

  // Fetch homework for a specific course under a semester and year
  const fetchHomework = async (year: number, semester: string, course: string) => {
    try {
      const tasksCollection = collection(
        db,
        `years/${year}/semesters/${semester}/courses/${course}/tasks`
      );
      const snapshot = await getDocs(tasksCollection);
      const homeworkList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          dueDate: data.dueDate,
          status: data.status,
          year,
          semester,
          course,
        } as HomeworkEntry;
      });

      setHomework(
        homeworkList.sort((a, b) => {
          if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
          if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return dateA - dateB;
        })
      );
    } catch (error) {
      console.error("Error fetching homework:", error);
    }
  };

  // Get style for days left
  const getDayStyle = (daysLeft: number): React.CSSProperties => {
    if (daysLeft === 0 || daysLeft < 3) {
      return { color: "#ff4c4c", fontWeight: "bold" }; // Bold red
    } else if (daysLeft < 7) {
      return { color: "orange", fontWeight: "bold" }; // Orange
    } else {
      return { color: "#2ECC71", fontWeight: "bold" }; // Green
    }
  };

  // Calculate notifications
  useEffect(() => {
    const now = new Date();
    const upcoming = homework
      .filter((entry) => {
        const dueDate = new Date(entry.dueDate);
        return (
          dueDate >= now &&
          dueDate <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .map((entry) => {
        const dueDate = new Date(entry.dueDate);
        const diffInTime = dueDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
        const message = `${entry.name} is due in ${daysLeft} day${
          daysLeft > 1 ? "s" : ""
        } `;
        const style = getDayStyle(daysLeft);
        return { id: entry.id, message, style }; // Include ID and style in notification
      });

    setNotifications(upcoming);
  }, [homework]);

  // Add or update homework
  const addHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string
  ) => {
    try {
      const tasksCollection = collection(
        db,
        `years/${year}/semesters/${semester}/courses/${course}/tasks`
      );

      if (id) {
        const taskDoc = doc(tasksCollection, id);
        await updateDoc(taskDoc, { name, dueDate, status });

        setHomework((prev) =>
          prev.map((entry) =>
            entry.id === id ? { ...entry, name, dueDate, status } : entry
          )
        );
      } else {
        const newTaskRef = doc(tasksCollection);
        const newTask = { id: newTaskRef.id, name, dueDate, status, year, semester, course };
        await setDoc(newTaskRef, newTask);

        setHomework((prev) => [...prev, newTask]);
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
    try {
      const taskDoc = doc(
        db,
        `years/${year}/semesters/${semester}/courses/${course}/tasks`,
        id
      );
      await deleteDoc(taskDoc);

      setHomework((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error("Error removing homework:", error);
    }
  };

  return (
    <HomeworkContext.Provider
      value={{
        homework,
        notifications,
        fetchHomework,
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
