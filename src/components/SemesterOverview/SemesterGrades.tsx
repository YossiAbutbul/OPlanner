import React from "react";
import { useSemesterGrades } from "../../hooks/useSemesterGrades";
import { formatGrade } from "../../utility/grades";
import { capitalizeWords } from "../../utility/dayCalendar";
import { courseColor } from "../../utility/courseColor";
import type { CourseInfo } from "../../types/models";

interface Props {
  year: number;
  semester: string;
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

// The semester's grades in one place: the GPA and the course grades behind
// it. Each course's own sheet lives on its Grades tab; this is the only view
// that puts them side by side. Renders nothing until at least one course has
// a grade, so it stays out of the way of anyone not using the feature.
const SemesterGrades: React.FC<Props> = ({ year, semester, courses, onSelectCourse }) => {
  const { byCourse, gpa } = useSemesterGrades(year, semester, courses);
  if (gpa === null) return null;

  return (
    <section className="overview-section ovg">
      <div className="ovg-head">
        <h2>Grades</h2>
        <span className="ovg-gpa">
          <span className="ovg-gpa-value">{formatGrade(gpa)}</span>
          <span className="ovg-gpa-label">average</span>
        </span>
      </div>

      <ul className="ovg-list">
        {byCourse.map((c) => {
          const info = courses.find((co) => co.name === c.course);
          return (
            <li key={c.course}>
              <button
                type="button"
                className="ovg-row"
                style={{ "--course-color": courseColor(c.course, info?.color) } as React.CSSProperties}
                onClick={() => onSelectCourse(c.course)}
              >
                <span className="ovg-dot" aria-hidden="true" />
                <span className="ovg-name">{capitalizeWords(c.course)}</span>
                <span className="ovg-state">{c.grade !== null && !c.complete ? "so far" : ""}</span>
                <span className={`ovg-grade${c.grade === null ? " ovg-grade-none" : ""}`}>
                  {c.grade === null ? "not yet" : formatGrade(c.grade)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default SemesterGrades;
