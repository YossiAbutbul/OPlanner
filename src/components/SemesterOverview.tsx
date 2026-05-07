import React, { useEffect, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import "../css/SemesterOverview.css";

interface Props {
  year: number;
  semester: string;
  courses: string[];
  onSelectCourse: (c: string) => void;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase());

interface CourseStats {
  course: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

const SemesterOverview: React.FC<Props> = ({ year, semester, courses, onSelectCourse }) => {
  const { getCourseTasks } = useHomework();
  const [byCourse, setByCourse] = useState<CourseStats[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lists = await Promise.all(
        courses.map((c) => getCourseTasks(year, semester, c))
      );
      if (cancelled) return;
      const now = new Date();
      const stats: CourseStats[] = courses.map((course, i) => {
        const list = lists[i];
        const completed = list.filter((t) => t.status === "COMPLETED").length;
        const pending = list.filter((t) => t.status === "PENDING").length;
        const overdue = list.filter(
          (t) => t.status === "PENDING" && new Date(t.dueDate) < now
        ).length;
        return { course, total: list.length, completed, pending, overdue };
      });
      setByCourse(stats);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, semester, courses, getCourseTasks]);

  const totals = byCourse.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      completed: acc.completed + s.completed,
      pending: acc.pending + s.pending,
      overdue: acc.overdue + s.overdue,
    }),
    { total: 0, completed: 0, pending: 0, overdue: 0 }
  );
  const completionPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <div className="overview">
      <header className="overview-header">
        <h1>{semester}</h1>
        <span className="overview-year">{year}</span>
      </header>

      <section className="overview-stats">
        <div className="stat-card">
          <div className="stat-label">Tasks</div>
          <div className="stat-value">{totals.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value stat-good">{totals.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{totals.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className={`stat-value ${totals.overdue > 0 ? "stat-bad" : ""}`}>
            {totals.overdue}
          </div>
        </div>
        <div className="stat-card stat-card-wide">
          <div className="stat-label">Completion</div>
          <div className="stat-value">{completionPct}%</div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      </section>

      <section className="overview-section">
        <h2>Courses</h2>
        {byCourse.length === 0 ? (
          <p className="overview-empty">No courses in this semester.</p>
        ) : (
          <ul className="course-stats">
            {byCourse.map((s) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <li
                  key={s.course}
                  className="course-stat"
                  onClick={() => onSelectCourse(s.course)}
                >
                  <div className="course-stat-row">
                    <span className="course-stat-name">{capitalizeWords(s.course)}</span>
                    <span className="course-stat-meta">
                      {s.completed}/{s.total}
                      {s.overdue > 0 && (
                        <span className="course-stat-overdue"> · {s.overdue} overdue</span>
                      )}
                    </span>
                  </div>
                  <div className="stat-bar">
                    <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
};

export default SemesterOverview;
