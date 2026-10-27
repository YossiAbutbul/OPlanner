import React from "react";
import type { HomeworkEntry } from "../../types/models";
import { capitalizeWords, timeLeft, urgencyClass } from "../../utility/dayCalendar";

interface Props {
  items: HomeworkEntry[];
  onItemClick: (t: HomeworkEntry) => void;
  colorOf: (t: HomeworkEntry) => string;
}

// Same row language as the overview's "Up next": calendar-style date,
// name over course and time, a days-left pill.
const UpcomingPanel: React.FC<Props> = ({ items, onItemClick, colorOf }) => (
  <>
    <header className="rs-head">
      <div className="rs-scope-row">
        <span className="rs-eyebrow">Next 14 days</span>
        <span className="rs-count">
          {items.length} {items.length === 1 ? "task" : "tasks"}
        </span>
      </div>
    </header>

    {items.length === 0 ? (
      <div className="rs-empty">
        <div className="rs-empty-badge">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="rs-empty-title">All caught up</p>
        <p className="rs-empty-text">
          Enjoy the calm.
        </p>
      </div>
    ) : (
      <ol className="rs-ag-list">
        {items.map((t, i) => {
          const time = t.endTime ?? t.startTime;
          const tl = timeLeft(t.dueDate, time);
          const tone = urgencyClass(tl.days);
          const d = new Date(t.dueDate + "T00:00:00");
          return (
            <li key={`${t.course}-${t.id}`} style={{ animationDelay: `${i * 40}ms` }}>
              <button
                type="button"
                className="rs-item"
                style={{ "--item-color": colorOf(t) } as React.CSSProperties}
                onClick={() => onItemClick(t)}
              >
                <span className="rs-item-date" aria-hidden="true">
                  <span className="rs-item-wd">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className="rs-item-day">{d.getDate()}</span>
                </span>
                <span className="rs-item-text">
                  <span className="rs-name" dir="auto">{t.name}</span>
                  <span className="rs-course">
                    <span className="rs-item-dot" aria-hidden="true" />
                    <span className="rs-course-name" dir="auto">{capitalizeWords(t.course)}</span>
                    {time && <span className="rs-item-time">{time}</span>}
                  </span>
                </span>
                <span className={`rs-ag-when rs-ag-when-${tone}`}>{tl.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    )}
  </>
);

export default UpcomingPanel;
