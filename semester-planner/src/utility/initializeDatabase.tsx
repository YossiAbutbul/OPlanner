import { doc, setDoc, getDocs, collection, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Initializes a year with its default semesters (A, B, C) and an empty courses list.
 * @param {number} year - The year to initialize.
 * @returns {Promise<boolean>} - Returns true if initialization is successful.
 */
export const initializeYear = async (year: number): Promise<boolean> => {
  try {
    const yearDoc = doc(db, "years", year.toString());
    await setDoc(yearDoc, {
      year,
      semesters: {
        A: { name: "Semester A", courses: [] },
        B: { name: "Semester B", courses: [] },
        C: { name: "Semester C", courses: [] },
      },
    });
    console.log(`Year ${year} initialized successfully.`);
    return true;
  } catch (error) {
    console.error(`Error initializing year ${year}:`, error);
    return false;
  }
};

/**
 * Fetches all years, including their semesters and courses, from Firestore.
 * @returns {Promise<Array<{ year: number; semesters: Array<{ name: string; courses: string[] }> }>>}
 */
export const getAllYearsAndSemesters = async (): Promise<
  Array<{
    year: number;
    semesters: { name: string; courses: string[] }[];
  }>
> => {
  try {
    const yearsCollection = collection(db, "years");
    const snapshot = await getDocs(yearsCollection);

    const yearsData = snapshot.docs.map((doc) => {
      const data = doc.data();
      const semesters = Object.entries(data.semesters || {})
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort semesters (A, B, C)
        .map(([key, value]: [string, any]) => ({
          name: value.name || `Semester ${key}`,
          courses: value.courses || [],
        }));

      return { year: data.year, semesters };
    });

    // Sort years in ascending order
    return yearsData.sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error("Error fetching years and semesters:", error);
    return [];
  }
};

/**
 * Adds a course to a specific semester under a specific year.
 * @param {number} year - The year of the semester.
 * @param {string} semester - The semester (A, B, C).
 * @param {string} course - The name of the course to add.
 * @returns {Promise<boolean>} - Returns true if the course is added successfully.
 */
export const addCourse = async (
  year: number,
  semester: string,
  course: string
): Promise<boolean> => {
  try {
    const yearDoc = doc(db, "years", year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (!yearSnapshot.exists()) {
      console.error(`Year ${year} does not exist.`);
      return false;
    }

    const yearData = yearSnapshot.data();
    const semesterKey = semester.replace("Semester ", ""); // Extract A, B, or C
    const semesterData = yearData.semesters[semesterKey] || {};

    const courses = semesterData.courses || [];
    if (courses.includes(course)) {
      console.warn(`Course "${course}" already exists in ${semester}, ${year}`);
      return false;
    }

    courses.push(course);

    await setDoc(yearDoc, {
      ...yearData,
      semesters: {
        ...yearData.semesters,
        [semesterKey]: {
          ...semesterData,
          courses,
        },
      },
    });

    console.log(`Course "${course}" added successfully to ${semester}, ${year}.`);
    return true;
  } catch (error) {
    console.error(`Error adding course: ${error}`);
    return false;
  }
};
