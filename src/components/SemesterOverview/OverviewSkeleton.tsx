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
        <div className="ovs-summary">
          <div className="ovs-progress">
            <span className="ovs-value"><Bar w="3.5rem" /></span>
            <span className="ovs-progress-label">complete</span>
          </div>
          <div className="ovs-bar" />
          <div className="ovs-side">
            <dl className="ovs-counts">
              {["Completed", "Pending", "Overdue"].map((label) => (
                <div key={label} className="ovs-count">
                  <dd><Bar w="1.6rem" /></dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="ovs-upnext">
          <div className="ovs-block-head">
            <span className="ovs-label">Up next</span>
            <span className="ovs-caption"><Bar w="5rem" /></span>
          </div>
          <ul className="ovs-upnext-list">
            {[0, 1].map((i) => (
              <li key={i}>
                <span className="ovs-upnext-item">
                  <span className="ovs-upnext-text">
                    <span className="ovs-upnext-name"><Bar w="60%" /></span>
                    <span className="ovs-upnext-meta"><Bar w="40%" /></span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="overview-grid">
        <section className="overview-section overview-calendar-section">
          <div className="cal">
            <div className="cal-header">
              <div className="cal-title">{month}</div>
              <div className="cal-nav ov-skel-nav" />
            </div>
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
