import { doc, setDoc, getDocs, collection, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Initializes a year with its default semesters and empty courses.
 */
export const initializeYear = async (year: number): Promise<boolean> => {
  try {
    const yearDoc = doc(db, "years", year.toString());
    const yearSnapshot = await getDoc(yearDoc);

    if (yearSnapshot.exists()) {
      console.warn(`Year ${year} already exists.`);
      return false;
    }

    // Create the year document
    await setDoc(yearDoc, { year });

    // Add default semesters
    const semesters = [
      { name: "Semester A", key: "A" },
      { name: "Semester B", key: "B" },
      { name: "Semester C", key: "C" },
    ];

    for (const semester of semesters) {
      const semesterDoc = doc(db, `years/${year}/semesters`, semester.key);
      await setDoc(semesterDoc, { name: semester.name });

      // Create an empty courses collection for each semester
      const coursesCollection = collection(db, `years/${year}/semesters/${semester.key}/courses`);
      console.log(`Created courses collection for ${semester.name}`);
    }

    console.log(`Year ${year} initialized successfully.`);
    return true;
  } catch (error) {
    console.error(`Error initializing year ${year}:`, error);
    return false;
  }
};

/**
 * Ensures at least one year exists in the database.
 * If no years are found, initializes the current year.
 */
export const initializeYearIfEmpty = async (): Promise<void> => {
  try {
    const yearsCollection = collection(db, "years");
    const snapshot = await getDocs(yearsCollection);

    if (snapshot.empty) {
      const currentYear = new Date().getFullYear();
      await initializeYear(currentYear);
      console.log(`No years found. Initialized current year: ${currentYear}.`);
    }
  } catch (error) {
    console.error("Error initializing year if empty:", error);
  }
};

/**
 * Fetches all years, including their semesters and courses, from Firestore.
 */
export const getAllYearsAndSemesters = async (): Promise<
  Array<{
    year: number;
    semesters: { name: string; key: string; courses: { name: string }[] }[];
  }>
> => {
  console.log("Fetching data from Firestore...");
  try {
    const yearsCollection = collection(db, "years");
    const snapshot = await getDocs(yearsCollection);
    console.log("Firestore Snapshot:", snapshot.docs);

    const yearsData = await Promise.all(
      snapshot.docs.map(async (yearDoc) => {
        const yearData = yearDoc.data();
        console.log("Year Document Data:", yearData);

        // Fetch semesters collection for the current year
        const semestersCollection = collection(db, `years/${yearDoc.id}/semesters`);
        const semestersSnapshot = await getDocs(semestersCollection);

        const semesters = await Promise.all(
          semestersSnapshot.docs.map(async (semesterDoc) => {
            const semesterData = semesterDoc.data();
            console.log("Semester Document Data:", semesterData);

            // Fetch courses collection for the current semester
            const coursesCollection = collection(
              db,
              `years/${yearDoc.id}/semesters/${semesterDoc.id}/courses`
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

    console.log("Parsed Years Data:", yearsData);
    return yearsData;
  } catch (error) {
    console.error("Error fetching years and semesters:", error);
    return [];
  }
};

/**
 * Adds a course to a specific semester under a specific year.
 */
export const addCourse = async (
  year: number,
  semester: string,
  course: string
): Promise<boolean> => {
  try {
    const semesterDoc = doc(db, `years/${year}/semesters/${semester}`);
    const semesterSnapshot = await getDoc(semesterDoc);

    if (!semesterSnapshot.exists()) {
      console.error(`Semester "${semester}" does not exist in year ${year}.`);
      return false;
    }

    const coursesCollection = collection(db, `years/${year}/semesters/${semester}/courses`);
    const courseDoc = doc(coursesCollection, course);
    await setDoc(courseDoc, { tasks: [] });

    console.log(`Course "${course}" added successfully to ${semester}, ${year}.`);
    return true;
  } catch (error) {
    console.error(`Error adding course: ${error}`);
    return false;
  }
};
