// File Name: HomeworkContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";
import {collection, getDocs, doc, addDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";

import { db } from "../firebase";

interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;
  status: string;
}

interface HomeworkContextProps {
  homework: HomeworkEntry[];
  notifications: string[];
  addHomework: (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => Promise<void>;
  removeHomework: (id: string) => Promise<void>;
}

const HomeworkContext = createContext<HomeworkContextProps | undefined>(
  undefined
);

export const HomeworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Fetch homework from Firestore
  useEffect(() => {
    const fetchHomework = async () => {
      try {
        const homeworkCollection = collection(db, "homework");
        const snapshot = await getDocs(homeworkCollection);
        const homeworkList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as HomeworkEntry[];

        setHomework(
          homeworkList.sort((a, b) => {
            // Sort by status first (COMPLETED first)
            if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
            if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;

            // Then sort by date (earliest first)
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            return dateA - dateB;
          })
        );
      } catch (error) {
        console.error("Error fetching homework:", error);
      }
    };

    fetchHomework();
  }, []);

  // Calculate notifications with a threshold of 2 weeks
  useEffect(() => {
    const now = new Date();
    const upcoming = homework
      .filter((entry) => {
        const dueDate = new Date(entry.dueDate);
        return (
          dueDate >= now &&
          dueDate <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // Next 2 weeks
        );
      })
      .map((entry) => {
        const dueDate = new Date(entry.dueDate);
        const diffInTime = dueDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffInTime / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
        return `Homework "${entry.name}" is due in ${daysLeft} day${
          daysLeft > 1 ? "s" : ""
        } (${entry.dueDate}).`;
      });

    setNotifications(upcoming);
  }, [homework]);

const addHomework = async (
  id: string | null,
  name: string,
  dueDate: string,
  status: string
) => {
  try {
    const homeworkCollection = collection(db, "homework");

    if (id) {
      // Update existing homework
      const homeworkDoc = doc(db, "homework", id);
      await updateDoc(homeworkDoc, { name, dueDate, status });

      setHomework((prev) =>
        prev
          .map((entry) =>
            entry.id === id ? { ...entry, name, dueDate, status } : entry
          )
          .sort((a, b) => {
            // Sort by status first (COMPLETED first)
            if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
            if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;

            // Then sort by date (earliest first)
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            return dateA - dateB;
          })
      );
    } else {
      // Add new homework
      const newId = Date.now().toString(); // Generate a unique ID based on timestamp
      const newEntry: HomeworkEntry = { id: newId, name, dueDate, status };
      const docRef = doc(homeworkCollection, newId); // Use generated ID as document ID
      await setDoc(docRef, newEntry); // Use setDoc instead of addDoc

      setHomework((prev) =>
        [...prev, newEntry].sort((a, b) => {
          // Sort by status first (COMPLETED first)
          if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
          if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;

          // Then sort by date (earliest first)
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return dateA - dateB;
        })
      );
    }
  } catch (error) {
    console.error("Error adding or updating homework:", error);
  }
};


  const removeHomework = async (id: string) => {
    try {
      if (!id) {
        console.error("Invalid document ID:", id);
        return;
      }

      const homeworkDoc = doc(db, "homework", id);
      await deleteDoc(homeworkDoc);

      setHomework((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error("Error removing homework:", error);
    }
  };

  return (
    <HomeworkContext.Provider
      value={{ homework, notifications, addHomework, removeHomework }}
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
