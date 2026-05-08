import React, { useEffect, useMemo, useRef, useState } from "react";
import "../css/DatePicker.css";

interface Props {
  value: string | null; // YYYY-MM-DD
  onChange: (value: string | null) => void;
  children: (open: () => void) => React.ReactNode;
  block?: boolean;
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

const parseIso = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const DatePicker: React.FC<Props> = ({ value, onChange, children, block }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => (value ? parseIso(value) : new Date()));
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setView(parseIso(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grid = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, -startOffset + i + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    return cells;
  }, [view]);

  const today = useMemo(() => toIso(new Date()), []);
  const selectedIso = value;

  const goPrev = () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1));
  const goNext = () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setView(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  return (
    <div className={`dp-wrap ${block ? "dp-wrap-block" : ""}`} ref={wrapRef}>
      {children(() => setOpen((v) => !v))}
      {open && (
        <div className="dp-popover" role="dialog" aria-label="Pick date">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={goPrev} aria-label="Previous month">
              ‹
            </button>
            <div className="dp-title">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button type="button" className="dp-nav" onClick={goNext} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="dp-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-weekday">{w}</span>
            ))}
          </div>
          <div className="dp-grid">
            {grid.map(({ date, inMonth }, i) => {
              const iso = toIso(date);
              const isSelected = iso === selectedIso;
              const isToday = iso === today;
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-cell ${inMonth ? "" : "dp-cell-out"} ${
                    isSelected ? "dp-cell-selected" : ""
                  } ${isToday ? "dp-cell-today" : ""}`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button
              type="button"
              className="dp-foot-btn dp-foot-clear"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              disabled={!value}
            >
              Clear
            </button>
            <button
              type="button"
              className="dp-foot-btn dp-foot-today"
              onClick={goToday}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
