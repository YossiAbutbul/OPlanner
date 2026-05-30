import React from "react";
import type { CourseInfo } from "../../types/models";
import type { CourseStats } from "../../hooks/useSemesterStats";
import { courseColor } from "../../utility/courseColor";
import { capitalizeWords } from "../../utility/dayCalendar";

interface Props {
  byCourse: CourseStats[];
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

const CoursesPanel: React.FC<Props> = ({ byCourse, courses, onSelectCourse }) => (
  <section className="overview-section">
    <h2>Courses</h2>
    <ul className="course-stats">
      {byCourse.map((s) => {
        const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        const courseInfo = courses.find((c) => c.name === s.course);
        const color = courseColor(s.course, courseInfo?.color);
        return (
          <li
            key={s.course}
            className="course-stat"
            onClick={() => onSelectCourse(s.course)}
          >
            <div className="course-stat-row">
              <span className="course-stat-name">{capitalizeWords(s.course)}</span>
              <span className="course-stat-meta">
                {s.overdue > 0 && (
                  <span className="course-stat-overdue">{s.overdue} overdue · </span>
                )}
                {s.completed}/{s.total}
              </span>
            </div>
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);

export default CoursesPanel;
