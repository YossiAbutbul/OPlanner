import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { seg } from "../utility/firestorePath";
import type { HomeworkEntry } from "../types/models";

// The Final Exam task's id inside each course (see setCourseFinalDate).
export const FINAL_TASK_ID = "final-exam";

// Imported tasks get a deterministic id so a re-import overwrites instead of
// duplicating. The prefix is also how the rest of the app tells a task that
// came from the university calendar from one the student wrote themselves.
export const IMPORTED_TASK_PREFIX = "imp_";

export const isImportedTaskId = (id: string): boolean => id.startsWith(IMPORTED_TASK_PREFIX);

// Window event carrying a course's new final date, so the year tree (which
// the Finals widget and reminders read) can follow edits made to the Final
// Exam task anywhere in the app.
export const FINAL_DATE_EVENT = "oplanner:final-date";
export interface FinalDateDetail {
  year: number;
  semester: string;
  course: string;
  date: string | null;
}

// Keep the course document's finalDate in step with its Final Exam task.
export const saveCourseFinalDate = async (
  uid: string,
  year: number,
  semester: string,
  course: string,
  date: string | null
): Promise<void> => {
  await updateDoc(doc(db, `users/${uid}/years/${year}/semesters/${seg(semester)}/courses/${seg(course)}`), {
    finalDate: date,
  });
};

// Firestore collection path for a course's tasks subcollection.
const tasksPath = (uid: string, year: number, semester: string, course: string) =>
  `users/${uid}/years/${year}/semesters/${seg(semester)}/courses/${seg(course)}/tasks`;

export const fetchCourseTasks = async (
  uid: string,
  year: number,
  semester: string,
  course: string
): Promise<HomeworkEntry[]> => {
  const snap = await getDocs(collection(db, tasksPath(uid, year, semester, course)));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
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
