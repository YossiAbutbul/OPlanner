import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // Ensure the correct path to your firebase.ts file

// Define the HomeworkEntry type
interface HomeworkEntry {
  id: string; // Firestore document ID
  name: string;
  dueDate: string; // Date in "YYYY-MM-DD" format
  status: string; // "PENDING" or "COMPLETED"
}

// Define the HomeworkContext type
interface HomeworkContextType {
  homework: HomeworkEntry[];
  addHomework: () => Promise<void>;
  removeHomework: (id: string) => Promise<void>;
  updateHomework: (id: string, field: keyof HomeworkEntry, value: string) => Promise<void>;
  notifications: string[];
}

// Create the HomeworkContext
const HomeworkContext = createContext<HomeworkContextType | undefined>(undefined);

// HomeworkProvider component
export const HomeworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Fetch data from Firestore on component mount
useEffect(() => {
  const fetchHomework = async () => {
    try {
      const homeworkCollection = collection(db, "homework");
      const snapshot = await getDocs(homeworkCollection);

      const homeworkList = snapshot.docs.map((doc) => ({
        id: doc.id, // Ensure the ID is included
        ...doc.data(),
      }));

      setHomework(homeworkList);
    } catch (error) {
      console.error("Error fetching homework:", error);
    }
  };

  fetchHomework();
}, []);



  // Generate notifications for due dates within the next 3 days
  useEffect(() => {
    const now = new Date();
    const upcoming = homework
      .filter((entry) => {
        const dueDate = new Date(entry.dueDate);
        return dueDate > now && dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      })
      .map((entry) => `Homework "${entry.name}" is due on ${entry.dueDate}`);
    setNotifications(upcoming);
  }, [homework]);

  // Add a new homework entry
const addHomework = async (id: string | null, name: string, dueDate: string, status: string) => {
  try {
    const homeworkCollection = collection(db, "homework");

    if (id) {
      // Update existing homework
      const homeworkDoc = doc(db, "homework", id);
      await updateDoc(homeworkDoc, { name, dueDate, status });

      setHomework((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, name, dueDate, status } : entry
        )
      );
    } else {
      // Add new homework
      const newEntry: HomeworkEntry = { id: "", name, dueDate, status };
      const docRef = await addDoc(homeworkCollection, newEntry);

      setHomework((prev) => [...prev, { ...newEntry, id: docRef.id }]);
    }
  } catch (error) {
    console.error("Error adding or updating homework:", error);
  }
};


  // Remove a homework entry
const removeHomework = async (id: string) => {
  try {
    if (!id) {
      throw new Error("Invalid document ID");
    }

    console.log("Deleting homework with ID:", id); // Debugging log

    const homeworkDoc = doc(db, "homework", id); // Reference the specific document
    console.log("Document reference:", homeworkDoc); // Debugging log

    await deleteDoc(homeworkDoc); // Delete the document from Firestore

    setHomework((prev) => prev.filter((entry) => entry.id !== id)); // Update local state
  } catch (error) {
    console.error("Error removing homework:", error);
  }
};




  // Update a homework entry
const updateHomework = async (id: string, name: string, dueDate: string, status: string) => {
  try {
    const homeworkDoc = doc(db, "homework", id); // Reference the specific document
    await updateDoc(homeworkDoc, { name, dueDate, status }); // Update the document

    setHomework((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, name, dueDate, status } : entry
      )
    );
  } catch (error) {
    console.error("Error updating homework:", error);
  }
};


  return (
    <HomeworkContext.Provider
      value={{ homework, addHomework, removeHomework, updateHomework, notifications }}
    >
      {children}
    </HomeworkContext.Provider>
  );
};

// Custom hook for accessing HomeworkContext
export const useHomework = () => {
  const context = useContext(HomeworkContext);
  if (!context) {
    throw new Error("useHomework must be used within a HomeworkProvider");
  }
  return context;
};
