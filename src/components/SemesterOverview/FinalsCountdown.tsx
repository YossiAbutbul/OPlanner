import React from "react";
import type { CourseInfo } from "../../types/models";
import DatePicker from "../DatePicker";
import { capitalizeWords } from "../../utility/dayCalendar";

const daysUntil = (iso: string): number => {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

interface Props {
  courses: CourseInfo[];
  onChangeFinalDate: (course: string, value: string) => void;
}

const FinalsCountdown: React.FC<Props> = ({ courses, onChangeFinalDate }) => (
  <section className="overview-section">
    <h2>Finals Countdown</h2>
    <ul className="finals-list">
      {courses.map((c, idx) => {
        const days = c.finalDate ? daysUntil(c.finalDate) : null;
        let badge = "";
        let badgeClass = "";
        if (days !== null) {
          if (days < 0) {
            badge = `${Math.abs(days)}d ago`;
            badgeClass = "finals-badge-past";
          } else if (days === 0) {
            badge = "Today";
            badgeClass = "finals-badge-soon";
          } else if (days <= 7) {
            badge = `${days}d`;
            badgeClass = "finals-badge-soon";
          } else if (days <= 30) {
            badge = `${days}d`;
            badgeClass = "finals-badge-near";
          } else {
            badge = `${days}d`;
            badgeClass = "finals-badge-far";
          }
        }
        let formatted: string | null = null;
        if (c.finalDate) {
          const d = new Date(c.finalDate + "T00:00:00");
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          formatted = `${dd}/${mm}/${yyyy}`;
        }
        return (
          <li key={c.name} className="finals-row">
            <span className="finals-row-name">{capitalizeWords(c.name)}</span>
            <span className={`finals-badge${badge ? ` ${badgeClass}` : " finals-badge-empty"}`}>
              {badge}
            </span>
            <DatePicker
              value={c.finalDate ?? null}
              onChange={(v) => onChangeFinalDate(c.name, v ?? "")}
            >
              {(open) => (
                <button
                  type="button"
                  className="finals-date"
                  data-tour={idx === 0 ? "finals" : undefined}
                  onClick={open}
                >
                  <svg
                    className="finals-date-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span
                    className={`finals-date-label ${formatted ? "" : "empty"}`}
                    dir="ltr"
                  >
                    {formatted ?? "Set date"}
                  </span>
                </button>
              )}
            </DatePicker>
          </li>
        );
      })}
    </ul>
  </section>
);

export default FinalsCountdown;
