import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from "../firebase";


// Define the HomeworkEntry type
interface HomeworkEntry {
  id: number;
  name: string;
  dueDate: string;
  status: string;
}

// Define the context type
interface HomeworkContextType {
  homework: HomeworkEntry[];
  addHomework: () => void;
  removeHomework: (id: number) => void;
  updateHomework: (id: number, field: keyof HomeworkEntry, value: string) => void;
  notifications: string[];
}

// Create the HomeworkContext
const HomeworkContext = createContext<HomeworkContextType | undefined>(undefined);

// HomeworkProvider Component
export const HomeworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    const fetchHomework = async () => {
      const homeworkCollection = collection(db, 'homework');
      const snapshot = await getDocs(homeworkCollection);
      const homeworkList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HomeworkEntry[];
      setHomework(homeworkList);
    };

    fetchHomework();
  }, []);

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

  const addHomework = async () => {
    const newEntry: HomeworkEntry = {
      id: Date.now(),
      name: 'New Homework',
      dueDate: 'YYYY-MM-DD',
      status: 'PENDING',
    };
    await addDoc(collection(db, 'homework'), newEntry);
    setHomework((prev) => [...prev, newEntry]);
  };

  const removeHomework = async (id: number) => {
    await deleteDoc(doc(db, 'homework', String(id)));
    setHomework((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateHomework = async (id: number, field: keyof HomeworkEntry, value: string) => {
    await updateDoc(doc(db, 'homework', String(id)), { [field]: value });
    setHomework((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  return (
    <HomeworkContext.Provider
      value={{ homework, addHomework, removeHomework, updateHomework, notifications }}
    >
      {children}
    </HomeworkContext.Provider>
  );
};

// Export the useHomework hook
export const useHomework = () => {
  const context = useContext(HomeworkContext);
  if (!context) {
    throw new Error('useHomework must be used within a HomeworkProvider');
  }
  return context;
};
