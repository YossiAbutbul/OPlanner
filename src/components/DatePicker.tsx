import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const POPOVER_WIDTH = 260;

const DatePicker: React.FC<Props> = ({ value, onChange, children, block }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<Date>(() => (value ? parseIso(value) : new Date()));
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setView(parseIso(value));
  }, [value]);

  // Compute fixed position so the popover escapes overflow:auto containers.
  // Pick above/below based on actual popover height, measured after render.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popH = popRef.current?.offsetHeight ?? 290;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < popH + 12 && spaceAbove > spaceBelow;
      const top = openUp ? rect.top - popH - 6 : rect.bottom + 6;
      // Prefer left-aligning the popover with the trigger; clamp to viewport.
      const desiredLeft = rect.left;
      const left = Math.min(
        Math.max(8, desiredLeft),
        window.innerWidth - POPOVER_WIDTH - 8
      );
      setPos({ top, left });
    };
    updatePos();
    // Re-measure after the popover renders for the first time.
    const raf = requestAnimationFrame(updatePos);
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrap = wrapRef.current?.contains(target);
      const inPop = popRef.current?.contains(target);
      if (!inWrap && !inPop) setOpen(false);
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

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
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
  const goToday = () => {
    const t = new Date();
    setView(new Date(t.getFullYear(), t.getMonth(), 1));
    onChange(toIso(t));
    setOpen(false);
  };

  return (
    <div className={`dp-wrap ${block ? "dp-wrap-block" : ""}`} ref={wrapRef}>
      {children(() => setOpen((v) => !v))}
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="dp-popover"
          role="dialog"
          aria-label="Pick date"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => { setSlideDir("right"); goPrev(); }} aria-label="Previous month">
              ‹
            </button>
            <div className="dp-title">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button type="button" className="dp-nav" onClick={() => { setSlideDir("left"); goNext(); }} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="dp-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-weekday">{w}</span>
            ))}
          </div>
          <div
            className="dp-grid"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            key={`${view.getFullYear()}-${view.getMonth()}`}
            data-slide={slideDir || undefined}
          >
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default DatePicker;
