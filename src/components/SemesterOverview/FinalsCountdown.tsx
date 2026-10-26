import React from "react";
import { CalendarPlus, Check } from "lucide-react";
import type { CourseInfo } from "../../types/models";
import DatePicker from "../DatePicker";
import { capitalizeWords } from "../../utility/dayCalendar";
import { courseColor } from "../../utility/courseColor";

const daysUntil = (iso: string): number => {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

interface Props {
  courses: CourseInfo[];
  onChangeFinalDate: (course: string, value: string) => void;
  // Opens the course's final-exam task; omitted where there is none.
  onOpenFinal?: (course: string) => void;
}

const FinalsCountdown: React.FC<Props> = ({ courses, onChangeFinalDate, onOpenFinal }) => {
  // Soonest finals first; courses without a date sink to the bottom.
  // Copy so the sidebar order (the `courses` prop) is left untouched.
  const sorted = [...courses].sort((a, b) => {
    if (!a.finalDate) return b.finalDate ? 1 : 0;
    if (!b.finalDate) return -1;
    return a.finalDate.localeCompare(b.finalDate);
  });
  return (
  <section className="overview-section">
    <h2>Finals Countdown</h2>
    <ul className="finals-list">
      {sorted.map((c) => {
        const days = c.finalDate ? daysUntil(c.finalDate) : null;
        let badge = "";
        let badgeClass = "";
        let urgency = "none";
        if (days !== null) {
          if (days < 0) {
            badge = "Done";
            badgeClass = "finals-badge-past";
            urgency = "past";
          } else if (days === 0) {
            badge = "Today";
            badgeClass = "finals-badge-soon";
            urgency = "soon";
          } else if (days <= 7) {
            badge = `${days} ${days === 1 ? "day" : "days"}`;
            badgeClass = "finals-badge-soon";
            urgency = "soon";
          } else if (days <= 30) {
            badge = `${days} days`;
            badgeClass = "finals-badge-near";
            urgency = "near";
          } else {
            badge = `${days} days`;
            badgeClass = "finals-badge-far";
            urgency = "far";
          }
        }
        const date = c.finalDate ? new Date(c.finalDate + "T00:00:00") : null;
        const sub = date
          ? date.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Tap the calendar to set a date";
        return (
          <li
            key={c.name}
            className="finals-row"
            data-urgency={urgency}
            style={{ "--tile-color": courseColor(c.name, c.color) } as React.CSSProperties}
          >
            <DatePicker
              value={c.finalDate ?? null}
              onChange={(v) => onChangeFinalDate(c.name, v ?? "")}
            >
              {(open) => (
                // Calendar-page tile: the date at a glance, and the control
                // that changes it.
                <button
                  type="button"
                  className={`finals-tile${date ? "" : " is-empty"}`}
                  onClick={open}
                  aria-label={date ? `Change final date for ${c.name}` : `Set final date for ${c.name}`}
                >
                  {date ? (
                    <>
                      <span className="finals-tile-month">
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="finals-tile-day">{date.getDate()}</span>
                    </>
                  ) : (
                    <CalendarPlus size={18} strokeWidth={2} />
                  )}
                </button>
              )}
            </DatePicker>
            <span className="finals-text">
              <span className="finals-row-name">{capitalizeWords(c.name)}</span>
              <span className="finals-sub" dir="ltr">{sub}</span>
            </span>
            {badge && (
              <button
                type="button"
                className={`finals-badge ${badgeClass}`}
                onClick={() => onOpenFinal?.(c.name)}
                title="Open the final exam task"
                aria-label={`Open the final exam task for ${c.name}`}
              >
                {urgency === "past" && <Check size={12} strokeWidth={3} />}
                {badge}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  </section>
  );
};

export default FinalsCountdown;
