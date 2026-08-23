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

// One column in the exams table — represents a single exam question.
export interface ExamColumn {
  id: string;     // crypto.randomUUID()
  label: string;  // e.g. "Q1"
}

// One row in the exams table — represents a single exam paper.
export interface ExamRow {
  id: string;                       // crypto.randomUUID()
  label: string;                    // e.g. "2022b moed 87"
  checks: Record<string, boolean>;  // keyed by ExamColumn id — questions done
  url?: string;                     // optional link to the exam
  solutionUrl?: string;             // optional link to the solution
}

// Per-course exam tracker: a checkbox grid of exams (rows) × questions
// (columns). Both axes' labels are user-editable.
export interface ExamTable {
  columns: ExamColumn[];
  rows: ExamRow[];
}

// Course-page metadata stored directly on the course doc at
// users/{uid}/years/{year}/semesters/{semester}/courses/{course}.
// All fields optional — legacy course docs have none of them.
export interface CourseMeta {
  links?: CourseLink[];     // ordered; max 20 (also enforced in firestore.rules)
  courseNotes?: string;     // sanitized HTML, <=50000 chars
  examTable?: ExamTable;    // exams × questions checkbox grid
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

// ─── Study Plan ──────────────────────────────────────────────────────────
// Degree-wide data: every course of the degree with its credits, grade and
// cost. Lives outside the year/semester tree — see docs/study-plan.md.

export type PlanCourseStatus =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "PLANNED"
  | "EXEMPT"
  | "FAILED"
  | "DROPPED";

// One graded part of a course: final exam, midterm, assignment average, lab.
export interface GradeComponent {
  id: string;
  label: string;
  weight: number;   // 0..100, should sum to 100 across the course
  grade?: number;   // 0..100, blank while unknown
}

// One course of the degree. Stored at users/{uid}/planCourses/{id}.
export interface PlanCourse {
  id: string;
  code?: string;            // catalog number from the portal — the dedupe key
  name: string;
  credits: number;          // 0..30
  status: PlanCourseStatus;
  year?: number;            // academic year, e.g. 2026
  semester?: string;        // "Semester A" | "Semester B" | "Semester C"
  groupId?: string;         // RequirementGroup id
  grade?: number;           // final grade, 0..100
  components?: GradeComponent[];
  countsToward?: boolean;   // false = audited, excluded from credits + average
  passFail?: boolean;       // credits count, grade stays out of the average
  costOverride?: number;    // per-course cost when it deviates from the model
  linkedCourse?: CourseTab; // matching course in the planner tree
  note?: string;
  source?: string;          // "manual" or the import batch id
  updatedAt: number;
}

export interface RequirementGroup {
  id: string;
  label: string;
  requiredCredits: number;
  color?: string;
}

export interface OneTimeFee {
  id: string;
  label: string;
  amount: number;
  paid?: boolean;
}

// How tuition is billed. Per credit is the common case; per course fits
// schools that price a whole course (the Open University, for example), often
// with a cap: once you have paid for `paidCoursesCap` courses, the rest of the
// degree costs nothing.
export type PricingMode = "PER_CREDIT" | "PER_COURSE";

export interface CostModel {
  currency: string;          // ISO-ish code, "ILS" default
  pricingMode?: PricingMode; // undefined = PER_CREDIT (legacy docs)
  pricePerCredit: number;
  pricePerCourse?: number;
  paidCoursesCap?: number;   // 0 or undefined = no cap, every course is billed
  perSemesterFee: number;    // registration, welfare, insurance
  oneTimeFees: OneTimeFee[];
  semestersRemainingOverride?: number;
}

export type PaymentKind =
  | "TUITION"
  | "FEE"
  | "BOOKS"
  | "SCHOLARSHIP"
  | "REFUND"
  | "OTHER";

// One charge or payment. Stored at users/{uid}/planPayments/{id}.
export interface PlanPayment {
  id: string;
  date: string;      // YYYY-MM-DD
  amount: number;    // negative for a scholarship or refund
  kind: PaymentKind;
  year?: number;
  semester?: string;
  note?: string;
  paid: boolean;     // false = scheduled, still due
}

// Single config doc at users/{uid}/plan/config.
export interface PlanConfig {
  degreeName: string;
  institution?: string;
  totalCreditsRequired: number;
  groups: RequirementGroup[];
  cost: CostModel;
  targetAverage?: number;
  passMark: number;          // 60 default
  startYear?: number;
  expectedEndYear?: number;
  updatedAt: number;
}

// Record of one import, kept so the batch can be undone.
// Stored at users/{uid}/planImports/{id}.
export interface PlanImportBatch {
  id: string;
  createdAt: number;
  fileName?: string;
  adapter: string;
  createdIds: string[];
  // Pre-import snapshots of the courses this batch overwrote.
  updatedBefore: PlanCourse[];
}
