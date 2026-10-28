import React, { useMemo, useState } from "react";
import type { SemesterTotals } from "../../hooks/useSemesterStats";
import type { HomeworkEntry } from "../../types/models";
import RollingNumber from "../RollingNumber";
import { capitalizeWords, isOverdue, timeLeft } from "../../utility/dayCalendar";

interface Props {
  totals: SemesterTotals;
  completionPct: number;
  // Every task in the semester, reminders included.
  tasks: HomeworkEntry[];
  // Course colour for a task, same as the calendar uses.
  colorOf: (t: HomeworkEntry) => string;
  onOpenTask: (t: HomeworkEntry) => void;
  // Off on a course page, where every row is the same course.
  showCourse?: boolean;
  // How many upcoming deadlines to list (fixed slots, so the card height
  // never changes). The course page's side column has room for more.
  upNextCount?: number;
}

// A non-zero count always gets a visible slice of the bar, however small
// next to the rest; the other segments give up the difference.
const MIN_PCT = 3;

// Rows an opened Up next list shows before it scrolls.
const MAX_EXPANDED = 4;

// Up next looks this far ahead; later dates live on the calendar.
const HORIZON_DAYS = 14;

const dueMoment = (t: HomeworkEntry) => t.dueDate + (t.endTime ?? t.startTime ?? "99:99");

interface Segment {
  key: string;
  pct: number;
}

// One bar, three segments: completed, pending, overdue, sized by count.
function statusSegments(totals: SemesterTotals): Segment[] {
  const parts = [
    { key: "done", value: totals.completed },
    { key: "open", value: totals.pending },
    { key: "late", value: totals.overdue },
  ].filter((p) => p.value > 0);
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return [];
  const raw = parts.map((p) => Math.max(MIN_PCT, (p.value / total) * 100));
  const sum = raw.reduce((n, v) => n + v, 0);
  return parts.map((p, i) => ({ key: p.key, pct: (raw[i] / sum) * 100 }));
}

// Summary: the completion figure over a segmented status bar (battery
// style, reads well in a short, wide space), the counts as its legend, and
// the next few deadlines as an Up Next list.
const OverviewStats: React.FC<Props> = ({
  totals,
  completionPct,
  tasks,
  colorOf,
  onOpenTask,
  showCourse = true,
  upNextCount = 2,
}) => {
  const upcoming = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(
        (t) =>
          t.status === "PENDING" &&
          !isOverdue(t.dueDate, t.endTime ?? t.startTime, now) &&
          timeLeft(t.dueDate).days < HORIZON_DAYS
      )
      .sort((a, b) => dueMoment(a).localeCompare(dueMoment(b)));
  }, [tasks]);

  // More deadlines than the card's rows: open the list in place, up to
  // MAX_EXPANDED rows, scrolling past that.
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, upcoming.length - upNextCount);
  const open = expanded && hiddenCount > 0;
  // Never fewer rows than closed (a course page shows 5).
  const maxRows = Math.max(MAX_EXPANDED, upNextCount);
  const rows = open ? Math.min(upcoming.length, maxRows) : upNextCount;

  const dueThisWeek = useMemo(
    () => upcoming.filter((t) => timeLeft(t.dueDate).days < 7).length,
    [upcoming]
  );

  const segments = statusSegments(totals);
  const counts = [
    { key: "done", label: "Completed", value: totals.completed },
    { key: "open", label: "Pending", value: totals.pending },
    { key: "late", label: "Overdue", value: totals.overdue },
  ];

  return (
    <section className="overview-stats" aria-label="Semester summary">
      <div className="ovs-summary">
        <div className="ovs-progress">
          <span className="ovs-value">
            <RollingNumber value={completionPct} suffix="%" />
          </span>
          <span className="ovs-progress-label">complete</span>
        </div>
        <div
          className="ovs-bar"
          role="img"
          aria-label={`${completionPct}% complete. ${counts.map((c) => `${c.label} ${c.value}`).join(", ")}`}
        >
          {segments.map((seg) => (
            <span
              key={seg.key}
              className={`ovs-bar-seg ovs-bar-${seg.key}`}
              style={{ flexGrow: seg.pct }}
            />
          ))}
        </div>
        <div className="ovs-side">
          <dl className="ovs-counts">
            {counts.map((c) => (
              <div
                key={c.key}
                className={`ovs-count ovs-count-${c.key}`}
                data-zero={c.value === 0 || undefined}
              >
                <dd><RollingNumber value={c.value} /></dd>
                <dt>{c.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="ovs-upnext" style={{ "--upnext-rows": rows } as React.CSSProperties}>
        <div className="ovs-block-head">
          <span className="ovs-label">Up next</span>
          <span className="ovs-caption">
            {dueThisWeek === 0 ? "Nothing this week" : `${dueThisWeek} this week`}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="ovs-upnext-more"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={open}
              >
                {open ? "Show less" : `+${hiddenCount} more`}
              </button>
            )}
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="ovs-upnext-empty">All clear for the next 2 weeks.</p>
        ) : (
          <ul className={`ovs-upnext-list${open && upcoming.length > maxRows ? " is-scroll" : ""}`}>
            {upcoming.slice(0, open ? upcoming.length : upNextCount).map((t) => {
              const left = timeLeft(t.dueDate, t.endTime ?? t.startTime);
              const tone = left.days <= 1 ? "soon" : left.days <= 3 ? "near" : "far";
              const d = new Date(t.dueDate + "T00:00:00");
              const time = t.endTime ?? t.startTime;
              return (
                <li key={`${t.course}|${t.id}`}>
                  <button
                    type="button"
                    className="ovs-upnext-item"
                    style={{ "--item-color": colorOf(t) } as React.CSSProperties}
                    onClick={() => onOpenTask(t)}
                  >
                    {/* Calendar-style date: weekday over day number. */}
                    <span className="ovs-upnext-date" aria-hidden="true">
                      <span className="ovs-upnext-wd">
                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="ovs-upnext-day">{d.getDate()}</span>
                    </span>
                    <span className="ovs-upnext-text">
                      <span className="ovs-upnext-name">{capitalizeWords(t.name)}</span>
                      <span className="ovs-upnext-meta">
                        {[showCourse ? (t.course === "reminders" ? "Reminder" : capitalizeWords(t.course)) : null, time]
                          .filter(Boolean)
                          .join(" · ") || "All day"}
                      </span>
                    </span>
                    <span className={`ovs-when ovs-when-${tone}`}>{left.short}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default OverviewStats;
