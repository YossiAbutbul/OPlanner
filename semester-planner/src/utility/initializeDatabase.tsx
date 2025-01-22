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
    const yearSnapshot = await getDoc(yearDoc);

    if (!yearSnapshot.exists()) {
      await setDoc(yearDoc, {
        year,
        semesters: {
          A: { courses: [] },
          B: { courses: [] },
          C: { courses: [] },
        },
      });
      console.log(`Year ${year} initialized successfully.`);
    } else {
      console.log(`Year ${year} already exists.`);
    }

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

      // Extract and sort semesters by alphabetical order
      const semesters = Object.entries(data.semesters || {})
        .map(([semesterKey, semesterValue]: [string, any]) => ({
          name: `Semester ${semesterKey}`,
          courses: semesterValue.courses || [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort by semester name

      return { year: data.year, semesters };
    });

    return yearsData.sort((a, b) => a.year - b.year); // Sort years numerically
  } catch (error) {
    console.error("Error fetching years and semesters:", error);
    return [];
  }
};

