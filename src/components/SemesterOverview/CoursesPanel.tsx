import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CourseInfo } from "../../types/models";
import type { CourseStats } from "../../hooks/useSemesterStats";
import { courseColor } from "../../utility/courseColor";
import { capitalizeWords } from "../../utility/dayCalendar";
import RollingNumber from "../RollingNumber";
import { ringDash } from "../../utility/ring";

interface Props {
  byCourse: CourseStats[];
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

// Checkmark that draws itself in once the ring has closed, and fades back
// out if the course drops below 100%.
const RingCheck: React.FC = () => {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      className="course-ring-check"
      viewBox="0 0 24 24"
      width={14}
      height={14}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", bounce: 0, visualDuration: 0.3, delay: reduce ? 0 : 0.45 }}
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.55 }}
      />
    </motion.svg>
  );
};

// Activity-style ring in the course colour. pathLength=100 lets the dash
// array read as a plain percentage; CSS transitions it when the value moves.
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
        style={{ strokeDasharray: ringDash(pct, 4, 15) }}
      />
    </svg>
    <AnimatePresence initial={true}>{done && <RingCheck key="check" />}</AnimatePresence>
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
            <span className="course-stat-pct">
              <RollingNumber value={pct} suffix="%" />
            </span>
          </li>
        );
      })}
    </ul>
  </section>
);

export default CoursesPanel;
