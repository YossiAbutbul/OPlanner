import React from "react";
import type { HomeworkEntry } from "../../types/models";
import {
  capitalizeWords,
  dayName,
  fmtDate,
  timeLeft,
  urgencyClass,
} from "../../utility/dayCalendar";

interface Props {
  items: HomeworkEntry[];
  onItemClick: (t: HomeworkEntry) => void;
}

const UpcomingPanel: React.FC<Props> = ({ items, onItemClick }) => (
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
      <ol className="rs-rail">
        {items.map((t, i) => {
          const tl = timeLeft(t.dueDate, t.endTime ?? t.startTime);
          const cls = urgencyClass(tl.days);
          const labelTop = tl.unit ? `${tl.num}` : tl.short; // "today"/"now" carry their own word
          const labelBot = tl.unit;
          return (
            <li
              key={`${t.course}-${t.id}`}
              className={`rs-row rs-${cls}`}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onItemClick(t)}
            >
              <div className={`rs-pip rs-pip-${cls}`}>
                <span className="rs-pip-num">{labelTop}</span>
                {labelBot && <span className="rs-pip-unit">{labelBot}</span>}
              </div>
              <div className="rs-card">
                <div className="rs-name">{t.name}</div>
                <div className="rs-course">{capitalizeWords(t.course)}</div>
                <div className="rs-date">
                  {dayName(t.dueDate)} {fmtDate(t.dueDate)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    )}
  </>
);

export default UpcomingPanel;
