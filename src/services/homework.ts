import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { HomeworkEntry } from "../types/models";

// Firestore collection path for a course's tasks subcollection.
const tasksPath = (uid: string, year: number, semester: string, course: string) =>
  `users/${uid}/years/${year}/semesters/${semester}/courses/${course}/tasks`;

export const fetchCourseTasks = async (
  uid: string,
  year: number,
  semester: string,
  course: string
): Promise<HomeworkEntry[]> => {
  const snap = await getDocs(collection(db, tasksPath(uid, year, semester, course)));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    year,
    semester,
    course,
  })) as HomeworkEntry[];
};

export const saveTask = async (
  uid: string,
  task: HomeworkEntry
): Promise<void> => {
  const ref = doc(
    db,
    tasksPath(uid, task.year, task.semester, task.course),
    task.id
  );
  await setDoc(ref, task, { merge: true });
};

export const createTaskRef = (
  uid: string,
  year: number,
  semester: string,
  course: string
) => doc(collection(db, tasksPath(uid, year, semester, course)));

export const deleteTask = async (
  uid: string,
  year: number,
  semester: string,
  course: string,
  id: string
): Promise<void> => {
  await deleteDoc(doc(db, tasksPath(uid, year, semester, course), id));
};
