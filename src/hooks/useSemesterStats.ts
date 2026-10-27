import { useEffect, useMemo, useState } from "react";
import type { CourseInfo, HomeworkEntry } from "../types/models";
import { isOverdue } from "../utility/dayCalendar";

const REMINDERS_COURSE = "reminders";

export interface CourseStats {
  course: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface SemesterTotals {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

// Fetches all tasks for every course in the semester (plus the synthetic
// "reminders" pseudo-course), computes per-course stats and overall totals,
// and returns them along with the task list for downstream views. Optimistic
// edits (applyEdits) are layered on top of the fetched lists, so a save
// shows up immediately instead of after the Firestore round trip.
// Triggers refetch when year/semester/course-set changes or when the
// homework context emits a new value.
export function useSemesterStats(
  year: number,
  semesterKey: string,
  courses: CourseInfo[],
  homeworkSnapshot: HomeworkEntry[],
  getCourseTasks: (year: number, sem: string, course: string, force?: boolean) => Promise<HomeworkEntry[]>,
  applyEdits: (list: HomeworkEntry[], inScope: (t: HomeworkEntry) => boolean) => HomeworkEntry[]
) {
  const [fetched, setFetched] = useState<HomeworkEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Reset the loaded gate only when the user navigates to a different
  // semester. Final-date / color edits mutate `courses` reference but
  // shouldn't blank the overview.
  useEffect(() => {
    setLoaded(false);
  }, [year, semesterKey]);

  // Stable key of course names so changes to per-course fields (finalDate,
  // color) don't refire the heavy task fetch.
  const courseNamesKey = courses.map((c) => c.name).sort().join("");

  useEffect(() => {
    let cancelled = false;
    // force=false: the locally saved copy (instant on reload); force=true:
    // the server. Show the saved copy first, then swap in fresh data, so a
    // reload doesn't sit on the skeleton for the network round trip.
    const load = async (force: boolean) => {
      const [lists, reminders] = await Promise.all([
        Promise.all(courses.map((c) => getCourseTasks(year, semesterKey, c.name, force))),
        getCourseTasks(year, semesterKey, REMINDERS_COURSE, force),
      ]);
      if (cancelled) return;
      setFetched([...lists.flat(), ...reminders]);
      setLoaded(true);
    };
    (async () => {
      await load(false);
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, semesterKey, courseNamesKey, getCourseTasks, homeworkSnapshot]);

  // Scope by year + course name: callers address a semester by key or by
  // display name, so the semester field isn't a reliable match.
  const allTasks = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return applyEdits(
      fetched,
      (t) => t.year === year && (names.has(t.course) || t.course === REMINDERS_COURSE)
    );
  }, [fetched, applyEdits, year, courses]);

  const byCourse = useMemo<CourseStats[]>(
    () =>
      courses.map((course) => {
        const list = allTasks.filter((t) => t.course === course.name);
        const completed = list.filter((t) => t.status === "COMPLETED").length;
        const isOver = (t: HomeworkEntry) =>
          t.status === "PENDING" &&
          isOverdue(t.dueDate, t.endTime ?? t.startTime);
        const overdue = list.filter(isOver).length;
        // Overdue tasks move out of pending — they're counted as overdue, not both.
        const pending = list.filter((t) => t.status === "PENDING" && !isOver(t)).length;
        return { course: course.name, total: list.length, completed, pending, overdue };
      }),
    [allTasks, courses]
  );

  const totals = byCourse.reduce<SemesterTotals>(
    (acc, s) => ({
      total: acc.total + s.total,
      completed: acc.completed + s.completed,
      pending: acc.pending + s.pending,
      overdue: acc.overdue + s.overdue,
    }),
    { total: 0, completed: 0, pending: 0, overdue: 0 }
  );
  const completionPct =
    totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return { byCourse, allTasks, loaded, totals, completionPct };
}
