import React from "react";
import type { CourseInfo } from "../../types/models";
import { capitalizeWords } from "../../utility/dayCalendar";
import { courseColor } from "../../utility/courseColor";
import { CourseRing } from "./CoursesPanel";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Placeholder shown while a semester's tasks load (switching years or
// semesters). It is built from the overview's own classes - stat cards,
// month grid, course and finals rows - so every box is exactly the size of
// what replaces it. Everything already known (labels, month, course names)
// is real text; only the numbers that depend on the task fetch shimmer.
// A non-breaking space keeps each shimmering line at its real line height.
const Bar: React.FC<{ w: string }> = ({ w }) => (
  <>
    <span className="ov-skel-bar" style={{ width: w }} />
    {" "}
  </>
);

const OverviewSkeleton: React.FC<{ courses: CourseInfo[] }> = ({ courses }) => {
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div className="ov-skel" aria-busy="true" aria-label="Loading semester">
      <section className="overview-stats">
        <div className="ovs-ring-block">
          <div className="ovs-ring">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle className="ovs-ring-track" cx="32" cy="32" r="27" />
            </svg>
          </div>
          <div className="ovs-ring-text">
            <span className="ovs-label">Completion</span>
            <span className="ovs-caption"><Bar w="9rem" /></span>
          </div>
        </div>
        <dl className="ovs-metrics">
          {["Tasks", "Completed", "Pending", "Overdue"].map((label) => (
            <div key={label} className="ovs-metric">
              <dt className="ovs-label">{label}</dt>
              <dd className="ovs-value"><Bar w="2.2rem" /></dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="overview-grid">
        <section className="overview-section overview-calendar-section">
          <div className="cal">
            <div className="cal-header">
              <div className="cal-title">{month}</div>
              <div className="cal-nav ov-skel-nav" />
            </div>
            <div className="cal-hint">Tip: double-click a day to add a task.</div>
            <div className="cal-weekdays">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-weekday">{w}</div>
              ))}
            </div>
            <div className="cal-grid">
              {Array.from({ length: 42 }, (_, i) => (
                <span key={i} className="cal-cell ov-skel-cell" />
              ))}
            </div>
          </div>
        </section>

        <div className="overview-grid-right">
          <section className="overview-section">
            <h2>Courses</h2>
            <ul className="course-stats">
              {courses.map((c) => (
                <li
                  key={c.name}
                  className="course-stat ov-skel-row"
                  style={{ "--course-color": courseColor(c.name, c.color) } as React.CSSProperties}
                >
                  <CourseRing pct={0} done={false} />
                  <span className="course-stat-text">
                    <span className="course-stat-name">{capitalizeWords(c.name)}</span>
                    <span className="course-stat-meta"><Bar w="5.5rem" /></span>
                  </span>
                  <span className="course-stat-pct"><Bar w="2rem" /></span>
                </li>
              ))}
            </ul>
          </section>
          <section className="overview-section">
            <h2>Finals Countdown</h2>
            <ul className="finals-list">
              {courses.map((c) => (
                <li key={c.name} className="finals-row">
                  <span className="finals-tile ov-skel-tile" />
                  <span className="finals-text">
                    <span className="finals-row-name">{capitalizeWords(c.name)}</span>
                    <span className="finals-sub"><Bar w="6.5rem" /></span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default OverviewSkeleton;
