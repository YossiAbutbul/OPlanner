import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HomeworkEntry } from "../context/HomeworkContext";
import "../css/CourseCalendar.css";

interface Props {
  tasks: HomeworkEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onCreateOnDate: (date: string) => void;
  /** Optional: returns a color for a task. When set, overrides the urgency bucket color. */
  colorOf?: (t: HomeworkEntry) => string | undefined;
  /** Optional: a small caption rendered inside the calendar card. */
  hint?: string;
  /** Max number of task pills to render per day cell before the "+N more" pill. */
  maxVisibleTasks?: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

type Bucket = "completed" | "danger" | "warn" | "ok";

const taskBucket = (t: HomeworkEntry, today: Date): Bucket => {
  if (t.status === "COMPLETED") return "completed";
  const due = startOfDay(new Date(t.dueDate));
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 5) return "danger";
  if (days <= 10) return "warn";
  return "ok";
};

const CourseCalendar: React.FC<Props> = ({
  tasks,
  selectedDate,
  onSelectDate,
  onCreateOnDate,
  colorOf,
  hint,
  maxVisibleTasks = 1,
}) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initial = selectedDate ? new Date(selectedDate) : today;
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, HomeworkEntry[]>();
    for (const t of tasks) {
      const iso = toIso(new Date(t.dueDate));
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(t);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({
        date: d,
        iso: toIso(d),
        inMonth: d.getMonth() === cursor.month,
      });
    }
    return cells;
  }, [cursor]);

  const isPastMonth =
    cursor.year < today.getFullYear() ||
    (cursor.year === today.getFullYear() && cursor.month < today.getMonth());

  const goPrev = () => {
    setCursor(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  };
  const goNext = () => {
    setCursor(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  };
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    onSelectDate(null);
  };

  useEffect(() => {
    const onScroll = () => {
      setHoverIso(null);
      setPopoverPos(null);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  const handleCellEnter = (e: React.MouseEvent<HTMLButtonElement>, iso: string, has: boolean) => {
    if (!has) {
      setHoverIso(null);
      setPopoverPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverIso(iso);
    const popWidth = 240;
    const margin = 8;
    let left = rect.left;
    if (left + popWidth + margin > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - popWidth - margin);
    }
    setPopoverPos({ top: rect.bottom + 6, left });
  };

  const handleCellLeave = () => {
    setHoverIso(null);
    setPopoverPos(null);
  };

  const hoverTasks = hoverIso ? tasksByDate.get(hoverIso) || [] : [];

  return (
    <div className={`cal ${isPastMonth ? "cal-past" : ""} ${selectedDate ? "cal-has-selection" : ""}`}>
      <div className="cal-header">
        <div className="cal-title">
          {MONTHS[cursor.month]} {cursor.year}
        </div>
        <div className="cal-nav">
          <button onClick={goPrev} aria-label="Previous month">‹</button>
          <button onClick={goToday} className="cal-today-btn">Today</button>
          <button onClick={goNext} aria-label="Next month">›</button>
        </div>
      </div>
      {hint && <div className="cal-hint">{hint}</div>}
      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
      </div>
      <div className="cal-grid" ref={gridRef}>
        {grid.map(({ date, iso, inMonth }) => {
          const isToday = iso === toIso(today);
          const isSelected = selectedDate === iso;
          const dayTasks = tasksByDate.get(iso) || [];
          const visible = dayTasks.slice(0, maxVisibleTasks);
          const more = dayTasks.length - visible.length;
          return (
            <button
              key={iso}
              type="button"
              className={`cal-cell ${inMonth ? "" : "out"} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => {
                if (isSelected) onCreateOnDate(iso);
                else onSelectDate(iso);
              }}
              onMouseEnter={(e) => handleCellEnter(e, iso, dayTasks.length > 0)}
              onMouseLeave={handleCellLeave}
            >
              <span className="cal-day-num">{date.getDate()}</span>
              {visible.length > 0 && (
                <span className="cal-tasks">
                  {visible.map((t) => {
                    const c = colorOf?.(t);
                    return (
                      <span
                        key={t.id}
                        className={`cal-task ${c ? "cal-task-custom" : `cal-task-${taskBucket(t, today)}`}`}
                        style={
                          c
                            ? ({
                                background: c,
                                color: "#fff",
                              } as React.CSSProperties)
                            : undefined
                        }
                      >
                        {t.name}
                      </span>
                    );
                  })}
                  {more > 0 && <span className="cal-task-more">+{more} more</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hoverIso && popoverPos && hoverTasks.length > 0 && createPortal(
        <div
          className="cal-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
          onMouseEnter={() => setHoverIso(hoverIso)}
          onMouseLeave={handleCellLeave}
        >
          <div className="cal-popover-date">{hoverIso}</div>
          <ul>
            {hoverTasks.map((t) => {
              const c = colorOf?.(t);
              return (
                <li key={t.id}>
                  <span
                    className={`cal-dot ${c ? "" : `cal-task-${taskBucket(t, today)}`}`}
                    style={c ? { background: c } : undefined}
                  />
                  <span className="cal-popover-name">{t.name}</span>
                  <span className="cal-popover-status">
                    {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="cal-popover-hint">Tap a day twice to add a task</div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CourseCalendar;
