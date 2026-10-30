import type { IcsEvent } from "./parseIcs";

// How calendar-import events become tasks. Assignments were always tasks;
// lectures and academic dates used to go to the Schedule as time blocks,
// where they couldn't be edited or deleted like everything else and never
// showed on the month grid. Now they are tasks too: a lecture in its course,
// an academic date with no course (the semester's reminders).

const SEMESTER_START = "התחלת סמסטר";

// Short stable hash so re-importing the same event lands on the same id.
export const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// "סתיו תשפ"ז (א2027)" -> "סתיו תשפ"ז"
export const seasonOf = (description: string) => description.replace(/\s*\([^)]*\)\s*$/, "").trim();

const plusHours = (time: string, hours: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// The ids earlier versions gave these events as Schedule blocks. The task
// keeps the same id, so a re-import replaces the old block one for one and
// stays idempotent from then on.
export const lectureId = (e: IcsEvent, course: string) => {
  const start = e.startTime ?? "07:00";
  return `imp_${e.startDate}_${start.replace(":", "")}_${hash(`${e.courseNumber ?? course}|${e.summary}`)}`;
};

export const academicId = (e: IcsEvent) => `imp_${e.startDate}_ac_${hash(e.summary + e.description)}`;

export interface ImportedTask {
  id: string;
  name: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export const lectureTask = (e: IcsEvent, course: string): ImportedTask => {
  const start = e.startTime ?? "07:00";
  return {
    id: lectureId(e, course),
    // The course page already says which course; the kind of session is
    // what tells two of them apart ("מפגש", "מפגש בהנחיה מקוונת").
    name: e.summary || "מפגש",
    dueDate: e.startDate,
    startTime: start,
    endTime: e.endTime ?? (e.startTime ? plusHours(start, 2) : "23:00"),
    ...(e.location ? { notes: e.location } : {}),
  };
};

// All-day, in the app's convention for tasks (see isAllDay).
export const academicTask = (e: IcsEvent): ImportedTask => {
  const season = seasonOf(e.description);
  return {
    id: academicId(e),
    name: season ? `${e.summary} · ${season}` : e.summary || "Academic date",
    dueDate: e.startDate,
    startTime: "07:00",
    endTime: "23:00",
  };
};

/**
 * The semester an academic date is filed under: the one running on that
 * date, so it shows where the student is when it happens. "Registration for
 * spring opens" falls in the autumn and belongs there, not in a spring the
 * student hasn't opened yet. Terms are read from the file's own "semester
 * starts" dates; with none before the date, the term the event names.
 */
export const academicHome = (
  e: IcsEvent,
  all: IcsEvent[]
): { year: number; semester: string } | null => {
  const starts = all
    .filter((x) => x.summary.trim() === SEMESTER_START && x.year && x.semester)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const running = starts.filter((s) => s.startDate <= e.startDate).pop();
  if (running) return { year: running.year!, semester: running.semester! };
  return e.year && e.semester ? { year: e.year, semester: e.semester } : null;
};

// A lecture or date that has already happened arrives done, so importing a
// term halfway through doesn't add a pile of overdue tasks.
export const importedStatus = (dueDate: string, today: string) =>
  dueDate < today ? "COMPLETED" : "PENDING";
