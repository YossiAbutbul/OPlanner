/**
 * Initializes a year with its default semesters and empty courses.
 */
export declare const initializeYear: (year: number) => Promise<boolean>;
/**
 * Ensures at least one year exists in the database.
 */
export declare const initializeYearIfEmpty: () => Promise<void>;
/**
 * Fetches all years, including their semesters and courses.
 */
export declare const getAllYearsAndSemesters: () => Promise<Array<{
    year: number;
    semesters: {
        name: string;
        key: string;
        courses: {
            name: string;
        }[];
    }[];
}>>;
/**
 * Adds a course to a specific semester.
 */
export declare const addCourse: (year: number, semester: string, course: string) => Promise<boolean>;
/**
 * Renames a course within a semester while retaining all nested data.
 */
export declare const renameCourse: (year: number, semester: string, oldName: string, newName: string) => Promise<boolean>;
/**
 * Deletes a course from a semester.
 */
export declare const deleteCourse: (year: number, semester: string, course: string) => Promise<boolean>;
/**
 * Deletes a year from the database.
 */
export declare const deleteYear: (year: number) => Promise<boolean>;
