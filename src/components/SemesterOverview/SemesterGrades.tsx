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
// two can share a slot. Each row leads with a tile in the column the Courses
// rings use, so swiping between the two keeps everything in place: the grade
// in the course's colour (solid once it's final), or, before any marks, the
// course's initial like the sidebar shows. The line under the name shows
// progress: a gauge and the share of the course marked so far. Each course's
// own sheet lives on its Grades tab.
const SemesterGrades: React.FC<Props> = ({ byCourse, courses, onSelectCourse }) => (
  <ul className="course-stats">
    {byCourse.map((c) => {
      const info = courses.find((co) => co.name === c.course);
      const empty = c.grade === null;
      const name = capitalizeWords(c.course);
      const status =
        c.weightOff !== null
          ? `Weights add up to ${formatGrade(c.weightOff)}%`
          : c.weightsUnset
            ? "Weights not set yet"
            : empty
              ? "No marks yet"
              : c.complete
                ? "Final grade"
                : `${Math.round(c.gradedWeight)}% graded`;
      return (
        <li
          key={c.course}
          className={`course-stat course-stat-graded${c.complete ? " is-done" : ""}${empty ? " is-empty" : ""}`}
          style={{ "--course-color": courseColor(c.course, info?.color) } as React.CSSProperties}
          onClick={() => onSelectCourse(c.course)}
        >
          <span className="grade-tile" aria-hidden={empty || undefined}>
            {empty ? name.trim().charAt(0) : formatGrade(c.grade!)}
          </span>
          <span className="course-stat-text">
            <span className="course-stat-name">
              <bdi>{name}</bdi>
            </span>
            <span className="course-stat-progress">
              {/* How much of the course the grade covers, as a gauge. */}
              {!empty && !c.complete && c.weightOff === null && (
                <span
                  className="course-stat-bar"
                  role="img"
                  aria-label={`${Math.round(c.gradedWeight)}% of the course graded`}
                >
                  <span style={{ width: `${c.gradedWeight}%` }} />
                </span>
              )}
              <span className={`course-stat-meta${c.weightOff !== null ? " is-error" : ""}`}>{status}</span>
            </span>
          </span>
        </li>
      );
    })}
  </ul>
);

export default SemesterGrades;
