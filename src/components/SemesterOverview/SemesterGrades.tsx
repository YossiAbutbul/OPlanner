import React from "react";
import { formatGrade } from "../../utility/grades";
import { capitalizeWords } from "../../utility/dayCalendar";
import { courseColor } from "../../utility/courseColor";
import type { CourseGrade } from "../../hooks/useSemesterGrades";
import type { CourseInfo } from "../../types/models";

interface Props {
  byCourse: CourseGrade[];
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

// The semester's course grades, in the same card as the Courses list so the
// two can share a slot. A bar stands where the ring would: how much of the
// course is marked, since a "so far" grade on 10% of it means much less
// than one on 90%. Each course's own sheet lives on its Grades tab.
const SemesterGrades: React.FC<Props> = ({ byCourse, courses, onSelectCourse }) => (
  <ul className="course-stats">
    {byCourse.map((c) => {
      const info = courses.find((co) => co.name === c.course);
      return (
        <li
          key={c.course}
          className={`course-stat course-stat-graded${c.complete ? " is-done" : ""}`}
          style={{ "--course-color": courseColor(c.course, info?.color) } as React.CSSProperties}
          onClick={() => onSelectCourse(c.course)}
        >
          <span className="course-stat-text">
            <span className="course-stat-name">{capitalizeWords(c.course)}</span>
            <span
              className="course-stat-bar"
              role="img"
              aria-label={`${Math.round(c.gradedWeight)}% of the course graded`}
            >
              <span style={{ width: `${c.gradedWeight}%` }} />
            </span>
            <span className={`course-stat-meta${c.weightOff !== null ? " is-error" : ""}`}>
              {c.weightOff !== null
                ? `Weights add up to ${formatGrade(c.weightOff)}%`
                : c.grade === null
                  ? "No marks yet"
                  : c.complete
                    ? "Final grade"
                    : `So far · ${Math.round(c.gradedWeight)}% graded`}
            </span>
          </span>
          <span className={`course-stat-pct course-stat-grade${c.grade === null ? " is-empty" : ""}`}>
            {c.grade === null ? "–" : formatGrade(c.grade)}
          </span>
        </li>
      );
    })}
  </ul>
);

export default SemesterGrades;
