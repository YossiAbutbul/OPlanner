import { doc, setDoc, getDocs, collection, getDoc, deleteDoc } from "firebase/firestore";
import { db, requireUid } from "../firebase";

const MAX_NAME_LENGTH = 100;

const isValidName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  if (/[\/\x00-\x1F\x7F]/.test(trimmed)) return false;
  if (trimmed === "." || trimmed === "..") return false;
  return true;
};

const userBase = () => `users/${requireUid()}`;

export const initializeYear = async (year: number): Promise<boolean> => {
  try {
    const base = userBase();
    const yearDoc = doc(db, `${base}/years`, year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (yearSnapshot.exists()) {
      console.warn(`Year ${year} already exists.`);
      return false;
    }

    await setDoc(yearDoc, { year });

    const semesters = [
      { name: "Semester A", key: "Semester A" },
      { name: "Semester B", key: "Semester B" },
      { name: "Semester C", key: "Semester C" },
    ];

    for (const semester of semesters) {
      const semesterDoc = doc(db, `${base}/years/${year}/semesters`, semester.key);
      await setDoc(semesterDoc, { name: semester.name });
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
    semesters: { name: string; key: string; courses: { name: string }[] }[];
  }>
> => {
  try {
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

            const courses = coursesSnapshot.docs.map((courseDoc) => ({
              name: courseDoc.id,
            }));

            return {
              name: semesterData.name || `Semester ${semesterDoc.id}`,
              key: semesterDoc.id,
              courses,
            };
          })
        );

        return { year: yearData.year, semesters };
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
    const courseDoc = doc(db, `${base}/years/${year}/semesters/${semester}/courses/${course}`);
    const courseSnapshot = await getDoc(courseDoc);

    if (!courseSnapshot.exists()) {
      console.error(`Course "${course}" does not exist.`);
      return false;
    }

    await deleteDoc(courseDoc);
    return true;
  } catch (error) {
    console.error(`Error deleting course: ${error}`);
    return false;
  }
};

export const deleteYear = async (year: number): Promise<boolean> => {
  try {
    const base = userBase();
    const yearDoc = doc(db, `${base}/years`, year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (!yearSnapshot.exists()) {
      console.error(`Year "${year}" does not exist.`);
      return false;
    }

    await deleteDoc(yearDoc);
    return true;
  } catch (error) {
    console.error(`Error deleting year: ${error}`);
    return false;
  }
};
