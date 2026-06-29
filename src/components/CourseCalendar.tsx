import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HomeworkEntry } from "../context/HomeworkContext";
import { isOverdue } from "../utility/dayCalendar";
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

const FULL_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "2026-06-16" -> "Tuesday, June 16" for the hover popover header. */
const formatPopoverDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${FULL_WEEKDAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}`;
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

  // Jump cursor when selectedDate moves to a different month (e.g. user just
  // saved a task on another month).
  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month) {
      setCursor({ year: d.getFullYear(), month: d.getMonth() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
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
    onSelectDate(toIso(today));
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
    // Touch devices emulate hover on tap, and the popover gets clipped by the
    // screen edges — only show it where real hover exists (desktop pointers).
    if (!window.matchMedia?.("(hover: hover)").matches) return;
    if (!has) {
      setHoverIso(null);
      setPopoverPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverIso(iso);
    const popWidth = 240;
    const margin = 8;
    const gap = 2;
    let left = rect.left;
    if (left + popWidth + margin > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - popWidth - margin);
    }
    // Open toward whichever side has more room so the full (unscrolled) list
    // stays on screen.
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    if (spaceBelow >= spaceAbove) {
      setPopoverPos({ top: rect.bottom + gap, left });
    } else {
      setPopoverPos({ bottom: window.innerHeight - rect.top + gap, left });
    }
  };

  const handleCellLeave = () => {
    setHoverIso(null);
    setPopoverPos(null);
  };

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x;
    const dy = t.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) {
      setSlideDir("left");
      goNext();
    } else {
      setSlideDir("right");
      goPrev();
    }
  };
  useEffect(() => {
    if (!slideDir) return;
    const t = setTimeout(() => setSlideDir(null), 220);
    return () => clearTimeout(t);
  }, [slideDir]);

  const hoverTasks = hoverIso ? tasksByDate.get(hoverIso) || [] : [];

  return (
    <div className={`cal ${isPastMonth ? "cal-past" : ""} ${selectedDate ? "cal-has-selection" : ""}`}>
      <div className="cal-header">
        <div className="cal-title">
          {MONTHS[cursor.month]} {cursor.year}
        </div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => { setSlideDir("right"); goPrev(); }} aria-label="Previous month"><ChevronLeft size={18} strokeWidth={2.5} /></button>
          <button onClick={goToday} className="cal-today-btn">Today</button>
          <button className="cal-nav-btn" onClick={() => { setSlideDir("left"); goNext(); }} aria-label="Next month"><ChevronRight size={18} strokeWidth={2.5} /></button>
        </div>
      </div>
      {hint && <div className="cal-hint">{hint}</div>}
      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
      </div>
      <div
        className="cal-grid"
        ref={gridRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        key={`${cursor.year}-${cursor.month}`}
        data-slide={slideDir || undefined}
      >
        {grid.map(({ date, iso, inMonth }) => {
          const isToday = iso === toIso(today);
          const isSelected = selectedDate === iso;
          const dayTasks = tasksByDate.get(iso) || [];
          const visible = dayTasks.slice(0, maxVisibleTasks);
          const more = dayTasks.length - visible.length;
          const hasOverdue = dayTasks.some(
            (t) => t.status !== "COMPLETED" && isOverdue(t.dueDate, t.endTime ?? t.startTime)
          );
          return (
            <button
              key={iso}
              type="button"
              className={`cal-cell ${inMonth ? "" : "out"} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${hasOverdue ? "cal-cell-overdue" : ""}`}
              onClick={() => onSelectDate(iso)}
              onDoubleClick={() => onCreateOnDate(iso)}
              onMouseEnter={(e) => handleCellEnter(e, iso, dayTasks.length > 0)}
              onMouseLeave={handleCellLeave}
            >
              {hasOverdue && <span className="cal-overdue-dot" title="Overdue task" aria-label="Overdue task" />}
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
          style={{ top: popoverPos.top, bottom: popoverPos.bottom, left: popoverPos.left }}
          onMouseEnter={() => setHoverIso(hoverIso)}
          onMouseLeave={handleCellLeave}
        >
          <div className="cal-popover-head">
            <span className="cal-popover-date">{formatPopoverDate(hoverIso)}</span>
            <span className="cal-popover-count">
              {hoverTasks.length} {hoverTasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          <ul>
            {hoverTasks.map((t) => {
              const c = colorOf?.(t);
              const done = t.status === "COMPLETED";
              const overdue = !done && isOverdue(t.dueDate, t.endTime ?? t.startTime);
              const status = done ? "Done" : overdue ? "Overdue" : "Pending";
              const statusClass = done ? "is-done" : overdue ? "is-overdue" : "is-pending";
              return (
                <li key={t.id}>
                  <span
                    className={`cal-dot ${c ? "" : `cal-task-${taskBucket(t, today)}`}`}
                    style={c ? { background: c } : undefined}
                  />
                  <span className="cal-popover-name">{t.name}</span>
                  <span className={`cal-popover-status ${statusClass}`}>
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="cal-popover-hint">Double-click a day to add a task</div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CourseCalendar;
