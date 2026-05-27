import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { useTimeBlocks, TimeBlock } from "../context/TimeBlockContext";
import HomeworkModal from "./HomeworkModal";
import TimeBlockModal from "./TimeBlockModal";
import DatePicker from "./DatePicker";
import { YearTreeData } from "../App";
import { courseColor } from "../utility/courseColor";
import "../css/RightSidebar.css";

interface RightSidebarProps {
  years: YearTreeData[];
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const capitalizeWords = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const dayName = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const longDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
};

const daysLeft = (iso: string) => {
  const due = startOfDay(new Date(iso));
  const now = startOfDay(new Date());
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const urgencyClass = (d: number) => {
  if (d <= 5) return "danger";
  if (d <= 10) return "warn";
  return "ok";
};

// Day view config
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const SLOT_MIN = 30;
const PX_PER_HOUR = 64; // 32px per 30-min slot
const DRAG_SNAP_MIN = 30;

const minutesFromStart = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h - DAY_START_HOUR) * 60 + m;
};

const minutesToHHmm = (mins: number) => {
  const abs = Math.max(0, Math.min(mins, (DAY_END_HOUR - DAY_START_HOUR) * 60));
  const total = abs + DAY_START_HOUR * 60;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const snapMin = (m: number) => Math.round(m / DRAG_SNAP_MIN) * DRAG_SNAP_MIN;
const pxToMin = (px: number) => (px * 60) / PX_PER_HOUR;

const totalDayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const totalDayPx = (totalDayMinutes / 60) * PX_PER_HOUR;

type DragState = {
  kind: "task" | "block";
  id: string;
  mode: "move" | "resize-top" | "resize-bottom";
  origStartMin: number; // minutes-from-day-start
  origEndMin: number;
  startY: number;
  deltaMin: number;
};

const hexToRgba = (hex: string, alpha: number) => {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const RightSidebar: React.FC<RightSidebarProps> = ({
  years,
  selectedYear,
  selectedSemester,
  selectedCourse,
}) => {
  void selectedCourse;
  const { getCourseTasks, addHomework, homework } = useHomework();
  const { blocks, saveBlock, removeBlock } = useTimeBlocks();

  const [tab, setTab] = useState<"upcoming" | "day">("upcoming");

  // Upcoming state
  const [items, setItems] = useState<HomeworkEntry[]>([]);
  const [allSemesterTasks, setAllSemesterTasks] = useState<HomeworkEntry[]>([]);
  const [editTask, setEditTask] = useState<HomeworkEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Day state
  const [dayDate, setDayDate] = useState<string>(() => toIso(new Date()));
  const [tbModalOpen, setTbModalOpen] = useState(false);
  const [tbInitial, setTbInitial] = useState<Partial<TimeBlock> | null>(null);

  const sources = useMemo(() => {
    const out: { year: number; semester: string; course: string }[] = [];
    if (selectedYear !== null && selectedSemester) {
      const y = years.find((yy) => yy.year === selectedYear);
      const s = y?.semesters.find((ss) => ss.name === selectedSemester);
      s?.courses.forEach((c) =>
        out.push({ year: selectedYear, semester: selectedSemester, course: c.name })
      );
    }
    return out;
  }, [years, selectedYear, selectedSemester]);

  // Suppress the next Firestore refetch triggered by our own optimistic write,
  // so the drag-updated times don't snap back to stale server data.
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const [lists, reminders] = await Promise.all([
        Promise.all(sources.map((s) => getCourseTasks(s.year, s.semester, s.course))),
        selectedYear !== null && selectedSemester
          ? getCourseTasks(selectedYear, selectedSemester, "reminders")
          : Promise.resolve([] as HomeworkEntry[]),
      ]);
      if (cancelled) return;
      const all = [...lists.flat(), ...reminders];
      setAllSemesterTasks(all);
      const now = startOfDay(new Date());
      const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const filtered = all
        .filter((t) => t.status === "PENDING")
        .filter((t) => {
          const d = startOfDay(new Date(t.dueDate));
          return d >= now && d <= horizon;
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setItems(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [sources, getCourseTasks, homework, selectedYear, selectedSemester]);

  const handleClick = (t: HomeworkEntry) => {
    setEditTask(t);
    setModalOpen(true);
  };

  // Resolve a task's accent color from its course (explicit color → deterministic fallback).
  const colorForTask = (t: HomeworkEntry): string => {
    if (t.course === "reminders") return "#7c4dff"; // distinct purple for reminders
    const y = years.find((yr) => yr.year === t.year);
    const s = y?.semesters.find((ss) => ss.name === t.semester || ss.key === t.semester);
    const c = s?.courses.find((cc) => cc.name === t.course);
    return courseColor(t.course, c?.color);
  };

  // Day view derived data
  // All-day = explicit 07:00-23:00, legacy 00:00-23:59, or task with no times.
  const isAllDay = (s?: string, e?: string) =>
    (s === "07:00" && e === "23:00") ||
    (s === "00:00" && e === "23:59") ||
    !s || !e;

  const dayTasks = useMemo(
    () => allSemesterTasks.filter((t) => t.dueDate === dayDate),
    [allSemesterTasks, dayDate]
  );
  const dayBlocks = useMemo(
    () => blocks.filter((b) => b.date === dayDate),
    [blocks, dayDate]
  );

  const allDayItems = useMemo(() => {
    const tasks = dayTasks
      .filter((t) => isAllDay(t.startTime, t.endTime))
      .map((t) => ({ kind: "task" as const, id: t.id, title: t.name, color: colorForTask(t), ref: t }));
    const blks = dayBlocks
      .filter((b) => isAllDay(b.startTime, b.endTime))
      .map((b) => ({ kind: "block" as const, id: b.id, title: b.title, color: b.color, ref: b }));
    return [...tasks, ...blks];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayTasks, dayBlocks, years]);

  const timedTasks = useMemo(
    () => dayTasks.filter((t) => t.startTime && t.endTime && !isAllDay(t.startTime, t.endTime)),
    [dayTasks]
  );
  const timedBlocks = useMemo(
    () => dayBlocks.filter((b) => !isAllDay(b.startTime, b.endTime)),
    [dayBlocks]
  );

  // Outlook-style overlap layout: greedy column packing per cluster.
  type LayoutEntry = { col: number; cols: number };
  const overlapLayout = useMemo(() => {
    type Ev = { key: string; start: number; end: number };
    const evs: Ev[] = [
      ...timedTasks.map((t) => ({
        key: `task-${t.id}`,
        start: minutesFromStart(t.startTime!),
        end: minutesFromStart(t.endTime!),
      })),
      ...timedBlocks.map((b) => ({
        key: `block-${b.id}`,
        start: minutesFromStart(b.startTime),
        end: minutesFromStart(b.endTime),
      })),
    ];
    evs.sort((a, b) => a.start - b.start || b.end - a.end);
    const map = new Map<string, LayoutEntry>();
    let cluster: Ev[] = [];
    let clusterEnd = -Infinity;
    let colsArr: number[] = []; // col index -> last end
    const flush = () => {
      const cols = colsArr.length;
      for (const e of cluster) {
        const r = map.get(e.key)!;
        r.cols = cols;
      }
      cluster = [];
      colsArr = [];
      clusterEnd = -Infinity;
    };
    for (const e of evs) {
      if (e.start >= clusterEnd) flush();
      let col = colsArr.findIndex((end) => end <= e.start);
      if (col === -1) {
        col = colsArr.length;
        colsArr.push(e.end);
      } else {
        colsArr[col] = e.end;
      }
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, e.end);
      map.set(e.key, { col, cols: 0 });
    }
    flush();
    return map;
  }, [timedTasks, timedBlocks]);

  const slotStyle = (key: string): React.CSSProperties => {
    const l = overlapLayout.get(key);
    if (!l || l.cols <= 1) return {};
    const widthPct = 100 / l.cols;
    return {
      left: `calc(${l.col * widthPct}% + 2px)`,
      width: `calc(${widthPct}% - 4px)`,
      right: "auto",
    };
  };

  // Now-line position
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (tab !== "day") return;
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(t);
  }, [tab]);

  const isToday = dayDate === toIso(new Date());
  const nowPx =
    isToday && nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60
      ? ((nowMinutes - DAY_START_HOUR * 60) / 60) * PX_PER_HOUR
      : null;

  const gridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to "now" once when entering day tab (not on minute ticks).
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (tab !== "day") {
      autoScrolledRef.current = false;
      return;
    }
    if (autoScrolledRef.current) return;
    if (!gridRef.current || nowPx === null) return;
    gridRef.current.scrollTop = Math.max(0, nowPx - 100);
    autoScrolledRef.current = true;
  }, [tab, nowPx]);

  // Listen for "open this day in sidebar" requests from calendar widgets.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (!detail?.date) return;
      setTab("day");
      setDayDate(detail.date);
    };
    window.addEventListener("oplanner:select-day", onPick);
    return () => window.removeEventListener("oplanner:select-day", onPick);
  }, []);

  const shiftDay = (delta: number) => {
    const d = new Date(dayDate);
    d.setDate(d.getDate() + delta);
    setDayDate(toIso(d));
  };

  // ===== Drag / resize =====
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  // Track if pointer actually moved (to suppress click after drag).
  const movedRef = useRef(false);

  const beginDrag = (
    e: React.MouseEvent,
    kind: "task" | "block",
    id: string,
    mode: "move" | "resize-top" | "resize-bottom",
    start: string,
    end: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    movedRef.current = false;
    setDrag({
      kind,
      id,
      mode,
      origStartMin: minutesFromStart(start),
      origEndMin: minutesFromStart(end),
      startY: e.clientY,
      deltaMin: 0,
    });
  };

  const commitDrag = useCallback((d: DragState) => {
    let startMin = d.origStartMin;
    let endMin = d.origEndMin;
    const snapped = snapMin(d.deltaMin);
    if (d.mode === "move") {
      const maxMin = totalDayMinutes;
      const dur = endMin - startMin;
      startMin = Math.max(0, Math.min(startMin + snapped, maxMin - dur));
      endMin = startMin + dur;
    } else if (d.mode === "resize-bottom") {
      endMin = Math.max(startMin + DRAG_SNAP_MIN, Math.min(endMin + snapped, totalDayMinutes));
    } else {
      // resize-top
      startMin = Math.min(endMin - DRAG_SNAP_MIN, Math.max(0, startMin + snapped));
    }
    const newStart = minutesToHHmm(startMin);
    const newEnd = minutesToHHmm(endMin);

    if (d.kind === "block") {
      const b = blocks.find((x) => x.id === d.id);
      if (!b) return;
      // saveBlock already updates local state optimistically before awaiting Firestore.
      void saveBlock({ ...b, startTime: newStart, endTime: newEnd });
    } else {
      const t = allSemesterTasks.find((x) => x.id === d.id);
      if (!t) return;
      // Block the next auto-refetch triggered by `homework` state change in
      // addHomework — Firestore may still return stale data.
      skipNextFetchRef.current = true;
      setAllSemesterTasks((prev) =>
        prev.map((x) =>
          x.id === t.id ? { ...x, startTime: newStart, endTime: newEnd } : x
        )
      );
      void addHomework(
        t.id,
        t.name,
        t.dueDate,
        t.status,
        t.year,
        t.semester,
        t.course,
        t.ignoreOverdue,
        undefined,
        newStart,
        newEnd
      );
    }
  }, [blocks, allSemesterTasks, saveBlock, addHomework]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const dy = e.clientY - cur.startY;
      // Smooth (per-minute) preview; snap only on commit.
      const rawMin = Math.round(pxToMin(dy));
      if (Math.abs(dy) > 3) movedRef.current = true;
      if (rawMin !== cur.deltaMin) {
        setDrag({ ...cur, deltaMin: rawMin });
      }
    };
    const onUp = () => {
      const cur = dragRef.current;
      // Apply optimistic state + clear drag in ONE flush so we never paint
      // a frame where state has new times but drag delta is still applied.
      flushSync(() => {
        if (cur && movedRef.current && cur.deltaMin !== 0) {
          commitDrag(cur);
        }
        setDrag(null);
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, commitDrag]);

  // Compute draft pixel offsets + display times for the dragged event
  const dragPreview = (kind: "task" | "block", id: string, startMin: number, endMin: number) => {
    if (!drag || drag.kind !== kind || drag.id !== id) {
      return {
        top: (startMin / 60) * PX_PER_HOUR + 1,
        height: Math.max(18, ((endMin - startMin) / 60) * PX_PER_HOUR - 2),
        startHHmm: minutesToHHmm(startMin),
        endHHmm: minutesToHHmm(endMin),
      };
    }
    let s = startMin;
    let e = endMin;
    if (drag.mode === "move") {
      const dur = e - s;
      s = Math.max(0, Math.min(s + drag.deltaMin, totalDayMinutes - dur));
      e = s + dur;
    } else if (drag.mode === "resize-bottom") {
      e = Math.max(s + DRAG_SNAP_MIN, Math.min(e + drag.deltaMin, totalDayMinutes));
    } else {
      s = Math.min(e - DRAG_SNAP_MIN, Math.max(0, s + drag.deltaMin));
    }
    return {
      top: (s / 60) * PX_PER_HOUR + 1,
      height: Math.max(18, ((e - s) / 60) * PX_PER_HOUR - 2),
      startHHmm: minutesToHHmm(s),
      endHHmm: minutesToHHmm(e),
    };
  };

  const handleSlotDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    const totalMin = Math.floor(y / PX_PER_HOUR * 60);
    // snap to 30
    const snapped = Math.floor(totalMin / SLOT_MIN) * SLOT_MIN;
    const startMin = DAY_START_HOUR * 60 + snapped;
    const endMin = startMin + 60;
    const hh = (n: number) => String(Math.floor(n / 60)).padStart(2, "0");
    const mm = (n: number) => String(n % 60).padStart(2, "0");
    setTbInitial({
      date: dayDate,
      startTime: `${hh(startMin)}:${mm(startMin)}`,
      endTime: `${hh(Math.min(endMin, DAY_END_HOUR * 60))}:${mm(Math.min(endMin, DAY_END_HOUR * 60))}`,
    });
    setTbModalOpen(true);
  };

  const hourLabels: string[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    hourLabels.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <aside className="rs">
      <div className="rs-glow" aria-hidden />

      <div className="rs-tabs" role="tablist" data-active={tab}>
        <button
          role="tab"
          aria-selected={tab === "upcoming"}
          className={`rs-tab ${tab === "upcoming" ? "rs-tab-active" : ""}`}
          onClick={() => setTab("upcoming")}
        >
          Upcoming
        </button>
        <button
          role="tab"
          aria-selected={tab === "day"}
          className={`rs-tab ${tab === "day" ? "rs-tab-active" : ""}`}
          onClick={() => setTab("day")}
        >
          Day
        </button>
        <span className="rs-tab-indicator" aria-hidden />
      </div>

      {tab === "upcoming" && (
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
                const d = daysLeft(t.dueDate);
                const cls = urgencyClass(d);
                const labelTop = d === 0 ? "today" : `${d}`;
                const labelBot = d === 0 ? "" : d === 1 ? "day" : "days";
                return (
                  <li
                    key={`${t.course}-${t.id}`}
                    className={`rs-row rs-${cls}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => handleClick(t)}
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
      )}

      {tab === "day" && (
        <>
          <header className="rs-day-head">
            <div className="rs-day-row">
              <button className="rs-day-nav-btn" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
              <DatePicker value={dayDate} onChange={(v) => v && setDayDate(v)} block>
                {(open) => (
                  <button type="button" className="rs-day-date" onClick={open}>
                    {longDay(dayDate)}
                  </button>
                )}
              </DatePicker>
              <button className="rs-day-nav-btn" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
              <button className="rs-day-today" onClick={() => setDayDate(toIso(new Date()))}>Today</button>
            </div>
            <div className="rs-day-hint">Tip: double-click a slot to add a block</div>
          </header>

          <div className="rs-day-scroll" ref={gridRef}>
            <div className="rs-day-grid" style={{ height: totalDayPx }}>
              {hourLabels.map((label, i) => (
                <div
                  key={label}
                  className="rs-day-hour"
                  style={{ top: i * PX_PER_HOUR }}
                >
                  <span className="rs-day-hour-label">{label}</span>
                  <span className="rs-day-hour-line" />
                  {i < hourLabels.length - 1 && (
                    <span
                      className="rs-day-half-line"
                      style={{ top: PX_PER_HOUR / 2 }}
                    />
                  )}
                </div>
              ))}

              <div
                className="rs-day-canvas"
                onDoubleClick={handleSlotDblClick}
                style={{ height: totalDayPx }}
              >
                {allDayItems.map((it, idx) => {
                  const accent = it.color ?? "#1db954";
                  const n = allDayItems.length;
                  const widthPct = 100 / n;
                  const adStart = minutesFromStart("07:00");
                  const adEnd = minutesFromStart("23:00");
                  const adTop = (adStart / 60) * PX_PER_HOUR + 1;
                  const adH = ((adEnd - adStart) / 60) * PX_PER_HOUR - 2;
                  return (
                    <div
                      key={`allday-${it.kind}-${it.id}`}
                      className="rs-day-event rs-day-event-allday"
                      style={{
                        top: adTop,
                        height: adH,
                        background: hexToRgba(accent, 0.18),
                        borderLeftColor: accent,
                        color: accent,
                        left: `calc(${idx * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        right: "auto",
                        padding: "6px 6px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.kind === "task") {
                          handleClick(it.ref as HomeworkEntry);
                        } else {
                          setTbInitial(it.ref as TimeBlock);
                          setTbModalOpen(true);
                        }
                      }}
                      title={it.title}
                    >
                      <div className="rs-day-event-allday-title">{it.title}</div>
                    </div>
                  );
                })}

                {timedTasks.map((t) => {
                  const sMin = minutesFromStart(t.startTime!);
                  const eMin = minutesFromStart(t.endTime!);
                  const { top, height, startHHmm, endHHmm } = dragPreview("task", t.id, sMin, eMin);
                  const isDragging = drag?.kind === "task" && drag.id === t.id;
                  const compact = height < 36;
                  const accent = colorForTask(t);
                  return (
                    <div
                      key={`task-${t.id}`}
                      className={`rs-day-event rs-day-event-task ${isDragging ? "rs-day-event-dragging" : ""} ${compact ? "rs-day-event-compact" : ""}`}
                      style={{
                        top,
                        height,
                        background: hexToRgba(accent, 0.45),
                        borderLeftColor: accent,
                        color: accent,
                        ...slotStyle(`task-${t.id}`),
                      }}
                      onMouseDown={(e) =>
                        beginDrag(e, "task", t.id, "move", t.startTime!, t.endTime!)
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (movedRef.current) return;
                        handleClick(t);
                      }}
                    >
                      <div
                        className="rs-day-event-resize rs-day-event-resize-top"
                        onMouseDown={(e) =>
                          beginDrag(e, "task", t.id, "resize-top", t.startTime!, t.endTime!)
                        }
                      />
                      {compact ? (
                        <div className="rs-day-event-compact-row">
                          <span className="rs-day-event-title">{t.name}</span>
                          <span className="rs-day-event-meta">{startHHmm}–{endHHmm}</span>
                        </div>
                      ) : (
                        <>
                          <div className="rs-day-event-title">{t.name}</div>
                          <div className="rs-day-event-meta">
                            {startHHmm}–{endHHmm} · {capitalizeWords(t.course)}
                          </div>
                        </>
                      )}
                      <div
                        className="rs-day-event-resize rs-day-event-resize-bottom"
                        onMouseDown={(e) =>
                          beginDrag(e, "task", t.id, "resize-bottom", t.startTime!, t.endTime!)
                        }
                      />
                    </div>
                  );
                })}

                {timedBlocks.map((b) => {
                  const sMin = minutesFromStart(b.startTime);
                  const eMin = minutesFromStart(b.endTime);
                  const { top, height, startHHmm, endHHmm } = dragPreview("block", b.id, sMin, eMin);
                  const isDragging = drag?.kind === "block" && drag.id === b.id;
                  const accent = b.color ?? "#7c4dff";
                  const compact = height < 36;
                  return (
                    <div
                      key={`block-${b.id}`}
                      className={`rs-day-event rs-day-event-block ${isDragging ? "rs-day-event-dragging" : ""} ${compact ? "rs-day-event-compact" : ""}`}
                      style={{
                        top,
                        height,
                        background: hexToRgba(accent, 0.45),
                        borderLeftColor: accent,
                        color: accent,
                        ...slotStyle(`block-${b.id}`),
                      }}
                      onMouseDown={(e) =>
                        beginDrag(e, "block", b.id, "move", b.startTime, b.endTime)
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (movedRef.current) return;
                        setTbInitial(b);
                        setTbModalOpen(true);
                      }}
                    >
                      <div
                        className="rs-day-event-resize rs-day-event-resize-top"
                        onMouseDown={(e) =>
                          beginDrag(e, "block", b.id, "resize-top", b.startTime, b.endTime)
                        }
                      />
                      {compact ? (
                        <div className="rs-day-event-compact-row">
                          <span className="rs-day-event-title">{b.title}</span>
                          <span className="rs-day-event-meta">{startHHmm}–{endHHmm}</span>
                        </div>
                      ) : (
                        <>
                          <div className="rs-day-event-title">{b.title}</div>
                          <div className="rs-day-event-meta">
                            {startHHmm}–{endHHmm}
                          </div>
                        </>
                      )}
                      <div
                        className="rs-day-event-resize rs-day-event-resize-bottom"
                        onMouseDown={(e) =>
                          beginDrag(e, "block", b.id, "resize-bottom", b.startTime, b.endTime)
                        }
                      />
                    </div>
                  );
                })}

                {nowPx !== null && (
                  <div className="rs-day-now" style={{ top: nowPx }}>
                    <span className="rs-day-now-dot" />
                    <span className="rs-day-now-line" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <HomeworkModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTask(null);
        }}
        onSave={async (id, name, dueDate, status, year, semester, course, ignoreOverdue, startTime, endTime) => {
          const prevLocation = id && editTask
            ? { year: editTask.year, semester: editTask.semester, course: editTask.course }
            : undefined;
          await addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue, prevLocation, startTime, endTime);
          setModalOpen(false);
          setEditTask(null);
        }}
        editHomework={editTask}
        selectedCourseData={editTask ? { year: editTask.year, semester: editTask.semester } : null}
        isLoading={false}
        availableCourses={editTask ? (years
          .find((y) => y.year === editTask.year)?.semesters
          .find((s) => s.name === editTask.semester || s.key === editTask.semester)?.courses
          .map((c) => c.name)
          .filter((n) => n !== "reminders") ?? []) : undefined}
      />

      <TimeBlockModal
        isOpen={tbModalOpen}
        onClose={() => {
          setTbModalOpen(false);
          setTbInitial(null);
        }}
        onSave={async (b) => {
          await saveBlock(b);
        }}
        onDelete={async (id) => {
          await removeBlock(id);
        }}
        initial={tbInitial}
      />
    </aside>
  );
};

export default RightSidebar;
