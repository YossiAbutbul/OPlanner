import React from "react";
import { Check } from "lucide-react";
import type { CourseInfo } from "../../types/models";
import type { CourseStats } from "../../hooks/useSemesterStats";
import { courseColor } from "../../utility/courseColor";
import { capitalizeWords } from "../../utility/dayCalendar";

interface Props {
  byCourse: CourseStats[];
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

// Activity-style ring in the course colour. pathLength=100 lets the dash
// array read as a plain percentage.
export const CourseRing: React.FC<{ pct: number; done: boolean }> = ({ pct, done }) => (
  <span className="course-ring" aria-hidden="true">
    <svg className="course-ring-svg" viewBox="0 0 36 36">
      <circle className="course-ring-track" cx="18" cy="18" r="15" />
      <circle
        className="course-ring-fill"
        cx="18"
        cy="18"
        r="15"
        pathLength={100}
        style={{ strokeDasharray: `${pct} 100` }}
      />
    </svg>
    {done && <Check className="course-ring-check" size={14} strokeWidth={3} />}
  </span>
);

const CoursesPanel: React.FC<Props> = ({ byCourse, courses, onSelectCourse }) => (
  <section className="overview-section">
    <h2>Courses</h2>
    <ul className="course-stats">
      {byCourse.map((s) => {
        const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        const courseInfo = courses.find((c) => c.name === s.course);
        const color = courseColor(s.course, courseInfo?.color);
        const done = s.total > 0 && s.completed === s.total;
        return (
          <li
            key={s.course}
            className={`course-stat${done ? " is-done" : ""}`}
            style={{ "--course-color": color } as React.CSSProperties}
            onClick={() => onSelectCourse(s.course)}
          >
            <CourseRing pct={pct} done={done} />
            <span className="course-stat-text">
              <span className="course-stat-name">{capitalizeWords(s.course)}</span>
              <span className="course-stat-meta">
                {s.total === 0
                  ? "No tasks yet"
                  : done
                    ? `All ${s.total} done`
                    : `${s.completed} of ${s.total} done`}
                {s.overdue > 0 && (
                  <span className="course-stat-overdue"> · {s.overdue} overdue</span>
                )}
              </span>
            </span>
            <span className="course-stat-pct">{pct}%</span>
          </li>
        );
      })}
    </ul>
  </section>
);

export default CoursesPanel;
