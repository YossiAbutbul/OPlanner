import { useEffect, useState } from "react";
import type { CourseInfo, HomeworkEntry } from "../types/models";

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
// and returns them along with the raw task list for downstream views.
// Triggers refetch when year/semester/course-set changes or when the
// homework context emits a new value.
export function useSemesterStats(
  year: number,
  semesterKey: string,
  courses: CourseInfo[],
  homeworkSnapshot: HomeworkEntry[],
  getCourseTasks: (year: number, sem: string, course: string) => Promise<HomeworkEntry[]>
) {
  const [byCourse, setByCourse] = useState<CourseStats[]>([]);
  const [allTasks, setAllTasks] = useState<HomeworkEntry[]>([]);
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
    (async () => {
      const [lists, reminders] = await Promise.all([
        Promise.all(courses.map((c) => getCourseTasks(year, semesterKey, c.name))),
        getCourseTasks(year, semesterKey, REMINDERS_COURSE),
      ]);
      if (cancelled) return;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const stats: CourseStats[] = courses.map((course, i) => {
        const list = lists[i];
        const completed = list.filter((t) => t.status === "COMPLETED").length;
        const pending = list.filter((t) => t.status === "PENDING").length;
        const overdue = list.filter(
          (t) =>
            t.status === "PENDING" &&
            !t.ignoreOverdue &&
            t.dueDate < todayStr
        ).length;
        return { course: course.name, total: list.length, completed, pending, overdue };
      });
      setByCourse(stats);
      setAllTasks([...lists.flat(), ...reminders]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, semesterKey, courseNamesKey, getCourseTasks, homeworkSnapshot]);

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
