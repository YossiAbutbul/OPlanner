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
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 8h24" />
          <path d="M20 56h24" />
          <path d="M22 8c0 14 20 14 20 24s-20 10-20 24" />
          <path d="M42 8c0 14-20 14-20 24s20 10 20 24" />
          <path d="M26 18c2 4 6 6 6 10" opacity=".5" />
        </svg>
        <p className="rs-empty-text">
          <em>Nothing</em> on the horizon.
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
