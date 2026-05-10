import { doc, setDoc, getDocs, collection, getDoc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db, requireUid, auth } from "../firebase";

const MAX_NAME_LENGTH = 100;

const isValidName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[/\x00-\x1F\x7F]/.test(trimmed)) return false;
  if (trimmed === "." || trimmed === "..") return false;
  return true;
};

const userBase = () => `users/${requireUid()}`;

const YEAR_COLOR_PALETTE = [
  "#1db954", "#3498db", "#9b59b6", "#e67e22",
  "#e74c3c", "#f1c40f", "#1abc9c", "#34495e", "#e91e63",
];

const SEMESTER_DEFAULT_COLORS: Record<string, string> = {
  "Semester A": "#1db954",
  "Semester B": "#3498db",
  "Semester C": "#e67e22",
};

const randomYearColor = () =>
  YEAR_COLOR_PALETTE[Math.floor(Math.random() * YEAR_COLOR_PALETTE.length)];

export const initializeYear = async (year: number): Promise<boolean> => {
  try {
    const base = userBase();
    const yearDoc = doc(db, `${base}/years`, year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (yearSnapshot.exists()) {
      return false;
    }

    await setDoc(yearDoc, { year, color: randomYearColor() });

    const semesters = [
      { name: "Semester A", key: "Semester A" },
      { name: "Semester B", key: "Semester B" },
      { name: "Semester C", key: "Semester C" },
    ];

    for (const semester of semesters) {
      const semesterDoc = doc(db, `${base}/years/${year}/semesters`, semester.key);
      await setDoc(semesterDoc, {
        name: semester.name,
        color: SEMESTER_DEFAULT_COLORS[semester.key],
      });
    }

    return true;
  } catch (error) {
    console.error(`Error initializing year ${year}:`, error);
    return false;
  }
};

export const initializeYearIfEmpty = async (): Promise<void> => {
  try {
    const base = userBase();
    const yearsCollection = collection(db, `${base}/years`);
    const snapshot = await getDocs(yearsCollection);

    if (snapshot.empty) {
      const currentYear = new Date().getFullYear();
      await initializeYear(currentYear);
    }
  } catch (error) {
    console.error("Error initializing year if empty:", error);
  }
};

export const getAllYearsAndSemesters = async (): Promise<
  Array<{
    year: number;
    color?: string;
    semesters: {
      name: string;
      key: string;
      color?: string;
      courses: { name: string; finalDate?: string; color?: string }[];
    }[];
  }>
> => {
  try {
    await auth.authStateReady();
    const base = userBase();
    const yearsCollection = collection(db, `${base}/years`);
    const snapshot = await getDocs(yearsCollection);

    const yearsData = await Promise.all(
      snapshot.docs.map(async (yearDoc) => {
        const yearData = yearDoc.data();

        const semestersCollection = collection(db, `${base}/years/${yearDoc.id}/semesters`);
        const semestersSnapshot = await getDocs(semestersCollection);

        const semesters = await Promise.all(
          semestersSnapshot.docs.map(async (semesterDoc) => {
            const semesterData = semesterDoc.data();

            const coursesCollection = collection(
              db,
              `${base}/years/${yearDoc.id}/semesters/${semesterDoc.id}/courses`
            );
            const coursesSnapshot = await getDocs(coursesCollection);

            const courseDocs = coursesSnapshot.docs.map((d) => ({
              id: d.id,
              data: d.data(),
            }));
            const courseNames = courseDocs.map((c) => c.id);
            const order: string[] = Array.isArray(semesterData.courseOrder)
              ? (semesterData.courseOrder as string[])
              : [];
            const known = new Set(courseNames);
            const ordered = [
              ...order.filter((n) => known.has(n)),
              ...courseNames.filter((n) => !order.includes(n)).sort(),
            ];
            const dataByName = new Map(courseDocs.map((c) => [c.id, c.data]));
            const courses = ordered.map((name) => {
              const d = dataByName.get(name);
              return {
                name,
                finalDate: typeof d?.finalDate === "string" ? d.finalDate : undefined,
                color: typeof d?.color === "string" ? d.color : undefined,
              };
            });

            return {
              name: semesterData.name || `Semester ${semesterDoc.id}`,
              key: semesterDoc.id,
              color: typeof semesterData.color === "string" ? semesterData.color : undefined,
              courses,
            };
          })
        );

        return {
          year: yearData.year,
          color: typeof yearData.color === "string" ? yearData.color : undefined,
          semesters,
        };
      })
    );

    return yearsData;
  } catch (error) {
    console.error("Error fetching years and semesters:", error);
    return [];
  }
};

export const addCourse = async (
  year: number,
  semester: string,
  course: string
): Promise<boolean> => {
  try {
    if (!isValidName(course)) {
      console.error(`Invalid course name: "${course}"`);
      return false;
    }
    course = course.trim();
    const base = userBase();
    const semesterDoc = doc(db, `${base}/years/${year}/semesters/${semester}`);
    const semesterSnapshot = await getDoc(semesterDoc);

    if (!semesterSnapshot.exists()) {
      console.error(`Semester "${semester}" does not exist in year ${year}.`);
      return false;
    }

    const coursesCollection = collection(db, `${base}/years/${year}/semesters/${semester}/courses`);
    const courseDoc = doc(coursesCollection, course);
    await setDoc(courseDoc, { tasks: [] });
    return true;
  } catch (error) {
    console.error(`Error adding course: ${error}`);
    return false;
  }
};

export const renameCourse = async (
  year: number,
  semester: string,
  oldName: string,
  newName: string
): Promise<boolean> => {
  try {
    if (!isValidName(newName)) {
      console.error(`Invalid course name: "${newName}"`);
      return false;
    }
    newName = newName.trim();
    const base = userBase();
    const coursesCollection = collection(db, `${base}/years/${year}/semesters/${semester}/courses`);
    const oldCourseDoc = doc(coursesCollection, oldName);
    const oldCourseSnapshot = await getDoc(oldCourseDoc);

    if (!oldCourseSnapshot.exists()) {
      console.error(`Course "${oldName}" does not exist.`);
      return false;
    }

    const newCourseDoc = doc(coursesCollection, newName);
    const newCourseSnapshot = await getDoc(newCourseDoc);

    if (newCourseSnapshot.exists()) {
      console.error(`Course "${newName}" already exists.`);
      return false;
    }

    const courseData = oldCourseSnapshot.data();
    await setDoc(newCourseDoc, courseData);

    const oldTasksCollection = collection(db, `${base}/years/${year}/semesters/${semester}/courses/${oldName}/tasks`);
    const oldTasksSnapshot = await getDocs(oldTasksCollection);

    for (const task of oldTasksSnapshot.docs) {
      const newTaskDoc = doc(db, `${base}/years/${year}/semesters/${semester}/courses/${newName}/tasks`, task.id);
      await setDoc(newTaskDoc, task.data());
    }

    // Delete old task docs so the orphan subcollection isn't left behind.
    for (let i = 0; i < oldTasksSnapshot.docs.length; i += 450) {
      const batch = writeBatch(db);
      for (const t of oldTasksSnapshot.docs.slice(i, i + 450)) {
        batch.delete(doc(db, `${base}/years/${year}/semesters/${semester}/courses/${oldName}/tasks/${t.id}`));
      }
      await batch.commit();
    }

    await deleteDoc(oldCourseDoc);
    return true;
  } catch (error) {
    console.error(`Error renaming course: ${error}`);
    return false;
  }
};

export const deleteCourse = async (year: number, semester: string, course: string): Promise<boolean> => {
  try {
    const base = userBase();
    const coursePath = `${base}/years/${year}/semesters/${semester}/courses/${course}`;
    const courseDoc = doc(db, coursePath);
    const courseSnapshot = await getDoc(courseDoc);

    if (!courseSnapshot.exists()) {
      console.error(`Course "${course}" does not exist.`);
      return false;
    }

    // Cascade-delete tasks subcollection (Firestore does not auto-cascade).
    const tasksSnap = await getDocs(collection(db, `${coursePath}/tasks`));
    const taskDocs = tasksSnap.docs;
    for (let i = 0; i < taskDocs.length; i += 450) {
      const batch = writeBatch(db);
      for (const t of taskDocs.slice(i, i + 450)) {
        batch.delete(doc(db, `${coursePath}/tasks/${t.id}`));
      }
      await batch.commit();
    }

    await deleteDoc(courseDoc);
    return true;
  } catch (error) {
    console.error(`Error deleting course: ${error}`);
    return false;
  }
};

export const FINAL_TASK_ID = "final-exam";

export const setCourseFinalDate = async (
  year: number,
  semester: string,
  course: string,
  date: string | null
): Promise<boolean> => {
  try {
    const base = userBase();
    const courseRef = doc(db, `${base}/years/${year}/semesters/${semester}/courses/${course}`);
    const finalTaskRef = doc(
      db,
      `${base}/years/${year}/semesters/${semester}/courses/${course}/tasks/${FINAL_TASK_ID}`
    );

    await updateDoc(courseRef, { finalDate: date ?? null });

    if (date) {
      await setDoc(
        finalTaskRef,
        {
          name: "Final Exam",
          dueDate: date,
          status: "PENDING",
          isFinal: true,
        },
        { merge: true }
      );
    } else {
      const snap = await getDoc(finalTaskRef);
      if (snap.exists()) {
        await deleteDoc(finalTaskRef);
      }
    }
    return true;
  } catch (error) {
    console.error("Error setting course final date:", error);
    return false;
  }
};

export const setYearColor = async (year: number, color: string | null): Promise<boolean> => {
  try {
    const base = userBase();
    const yearDoc = doc(db, `${base}/years`, year.toString());
    await updateDoc(yearDoc, { color: color ?? null });
    return true;
  } catch (error) {
    console.error("Error setting year color:", error);
    return false;
  }
};

export const setSemesterColor = async (
  year: number,
  semester: string,
  color: string | null
): Promise<boolean> => {
  try {
    const base = userBase();
    const semDoc = doc(db, `${base}/years/${year}/semesters/${semester}`);
    await updateDoc(semDoc, { color: color ?? null });
    return true;
  } catch (error) {
    console.error("Error setting semester color:", error);
    return false;
  }
};

export const setCourseColor = async (
  year: number,
  semester: string,
  course: string,
  color: string | null
): Promise<boolean> => {
  try {
    const base = userBase();
    const courseDoc = doc(
      db,
      `${base}/years/${year}/semesters/${semester}/courses/${course}`
    );
    await updateDoc(courseDoc, { color: color ?? null });
    return true;
  } catch (error) {
    console.error("Error setting course color:", error);
    return false;
  }
};

export const setCourseOrder = async (
  year: number,
  semester: string,
  order: string[]
): Promise<boolean> => {
  try {
    const base = userBase();
    const semesterDoc = doc(db, `${base}/years/${year}/semesters/${semester}`);
    await updateDoc(semesterDoc, { courseOrder: order });
    return true;
  } catch (error) {
    console.error("Error saving course order:", error);
    return false;
  }
};

export const deleteYear = async (year: number): Promise<boolean> => {
  try {
    const base = userBase();
    const yearPath = `${base}/years/${year}`;
    const yearDoc = doc(db, `${base}/years`, year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (!yearSnapshot.exists()) {
      console.error(`Year "${year}" does not exist.`);
      return false;
    }

    // Cascade: tasks → courses → semesters → year. Batched (<=500 ops/batch).
    let batch = writeBatch(db);
    let ops = 0;
    const flushIfNeeded = async () => {
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    };

    const semestersSnap = await getDocs(collection(db, `${yearPath}/semesters`));
    for (const semDoc of semestersSnap.docs) {
      const semPath = `${yearPath}/semesters/${semDoc.id}`;
      const coursesSnap = await getDocs(collection(db, `${semPath}/courses`));
      for (const courseDoc of coursesSnap.docs) {
        const coursePath = `${semPath}/courses/${courseDoc.id}`;
        const tasksSnap = await getDocs(collection(db, `${coursePath}/tasks`));
        for (const taskDoc of tasksSnap.docs) {
          batch.delete(doc(db, `${coursePath}/tasks/${taskDoc.id}`));
          ops++;
          await flushIfNeeded();
        }
        batch.delete(doc(db, coursePath));
        ops++;
        await flushIfNeeded();
      }
      batch.delete(doc(db, semPath));
      ops++;
      await flushIfNeeded();
    }
    batch.delete(yearDoc);
    ops++;
    await batch.commit();
    return true;
  } catch (error) {
    console.error(`Error deleting year: ${error}`);
    return false;
  }
};
