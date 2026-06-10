import type React from "react";

// One task / homework / final-exam entry. Stored at
// users/{uid}/years/{year}/semesters/{semester}/courses/{course}/tasks/{id}
export interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;        // YYYY-MM-DD
  status: string;         // "PENDING" | "DONE" | ...
  year: number;
  semester: string;
  course: string;
  ignoreOverdue?: boolean;
  startTime?: string;     // HH:mm
  endTime?: string;       // HH:mm
  notes?: string;         // sanitized HTML
  color?: string;         // accent override
}

// Generic time-blocked calendar event, not tied to a course.
// Stored at users/{uid}/timeBlocks/{id}
export interface TimeBlock {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  title: string;
  color?: string;
  courseId?: string;  // free-form ref e.g. "year|semester|course"
  notes?: string;
}

// Upcoming/overdue homework notification rendered in the sidebar.
export interface Notification {
  id: string;
  message: string;
  style: React.CSSProperties;
}

// One named link on a course (Moodle, Zoom, Drive folder, ...).
export interface CourseLink {
  id: string;     // crypto.randomUUID()
  label: string;
  url: string;    // http(s) only — validated before save
}

// Course-page metadata stored directly on the course doc at
// users/{uid}/years/{year}/semesters/{semester}/courses/{course}.
// All fields optional — legacy course docs have none of them.
export interface CourseMeta {
  links?: CourseLink[];     // ordered; max 20 (also enforced in firestore.rules)
  courseNotes?: string;     // sanitized HTML, <=50000 chars
}

// Course-level metadata returned by getAllYearsAndSemesters().
export interface CourseInfo {
  name: string;
  finalDate?: string;
  color?: string;
}

export interface SemesterInfo {
  name: string;
  key: string;
  color?: string;
  courses: CourseInfo[];
}

export interface YearTreeData {
  year: number;
  color?: string;
  semesters: SemesterInfo[];
}

// Active selection across the top-level tree.
export interface CourseTab {
  year: number;
  semester: string;
  course: string;
}
