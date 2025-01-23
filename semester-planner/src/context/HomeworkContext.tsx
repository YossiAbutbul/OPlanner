import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc, } from "firebase/firestore";
import { db } from "../firebase";

interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  year: string;
  semester: string;
}

interface HomeworkContextProps {
  homework: HomeworkEntry[];
  notifications: string[];
  fetchHomework: (year: string, semester: string) => Promise<void>;
  addHomework: (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: string,
    semester: string
  ) => Promise<void>;
  removeHomework: (id: string, year: string, semester: string) => Promise<void>;
}

const HomeworkContext = createContext<HomeworkContextProps | undefined>(
  undefined
);

export const HomeworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Fetch homework for a specific year and semester
  const fetchHomework = async (year: string, semester: string) => {
    try {
      const homeworkCollection = collection(
        db,
        `years/${year}/semesters/${semester}/tasks`
      );
      const snapshot = await getDocs(homeworkCollection);
      const homeworkList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HomeworkEntry[];

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
        return `Homework "${entry.name}" is due in ${daysLeft} day${
          daysLeft > 1 ? "s" : ""
        } (${entry.dueDate}).`;
      });

    setNotifications(upcoming);
  }, [homework]);

  // Add or update homework
  const addHomework = async (
  id,
  name,
  dueDate,
  status,
  year,
  semester
) => {
  try {
    if (!year || !semester) {
      throw new Error("Year and semester are required to add homework.");
    }

    console.log("Adding/Updating homework:", { id, name, dueDate, status, year, semester });

    const tasksCollection = collection(db, `years/${year}/semesters/${semester}/tasks`);

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
      const newTask = { id: newTaskRef.id, name, dueDate, status, year, semester };
      await setDoc(newTaskRef, newTask);

      setHomework((prev) => [...prev, newTask]);
    }
  } catch (error) {
    console.error("Error adding or updating homework:", error);
  }
};


  // Remove homework
  const removeHomework = async (id: string, year: string, semester: string) => {
    try {
      if (!id || !year || !semester) {
        throw new Error("Invalid data for removing homework.");
      }

      const taskDoc = doc(db, `years/${year}/semesters/${semester}/tasks`, id);
      await deleteDoc(taskDoc);

      setHomework((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error("Error removing homework:", error);
    }
  };

  return (
    <HomeworkContext.Provider
      value={{ homework, notifications, fetchHomework, addHomework, removeHomework }}
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
