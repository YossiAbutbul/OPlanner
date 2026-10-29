import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DatePicker from "../DatePicker";
import type { HomeworkEntry, TimeBlock } from "../../types/models";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DRAG_SNAP_MIN,
  PX_PER_HOUR,
  SLOT_MIN,
  capitalizeWords,
  hexToRgba,
  isAllDay,
  longDay,
  minutesFromStart,
  minutesToHHmm,
  pxToMin,
  snapMin,
  toIso,
  totalDayMinutes,
  totalDayPx,
} from "../../utility/dayCalendar";

/** True when the string contains any Hebrew character. */
const hasHebrew = (s?: string) => !!s && /[֐-׿]/.test(s);

type DragState = {
  kind: "task" | "block";
  id: string;
  mode: "move" | "resize-top" | "resize-bottom";
  origStartMin: number;
  origEndMin: number;
  startY: number;
  deltaMin: number;
};

interface CommitTaskArgs {
  task: HomeworkEntry;
  newStart: string;
  newEnd: string;
}

interface CommitBlockArgs {
  block: TimeBlock;
  newStart: string;
  newEnd: string;
}

interface SlotDblClickArgs {
  date: string;
  start: string;
  end: string;
}

interface Props {
  dayDate: string;
  onChangeDayDate: (d: string) => void;
  dayTasks: HomeworkEntry[];
  dayBlocks: TimeBlock[];
  colorForTask: (t: HomeworkEntry) => string;
  colorForBlock: (b: TimeBlock) => string;
  // The task's semester when it isn't the open one, to say where it's from.
  otherSemesterLabel?: (t: HomeworkEntry) => string | null;
  onTaskClick: (t: HomeworkEntry) => void;
  onBlockClick: (b: TimeBlock) => void;
  onSlotDblClick: (args: SlotDblClickArgs) => void;
  onCommitTaskDrag: (args: CommitTaskArgs) => void;
  onCommitBlockDrag: (args: CommitBlockArgs) => void;
}

const DayPanel: React.FC<Props> = ({
  dayDate,
  onChangeDayDate,
  dayTasks,
  dayBlocks,
  colorForTask,
  colorForBlock,
  otherSemesterLabel,
  onTaskClick,
  onBlockClick,
  onSlotDblClick,
  onCommitTaskDrag,
  onCommitBlockDrag,
}) => {
  // A task from another semester looks like any task here; hovering names
  // its semester, and opening it says so at the top of the dialog.
  const semesterOf = (t: HomeworkEntry) => otherSemesterLabel?.(t) ?? null;
  const allDayItems = useMemo(() => {
    const tasks = dayTasks
      .filter((t) => isAllDay(t.startTime, t.endTime))
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.name,
        color: colorForTask(t),
        other: otherSemesterLabel?.(t) ?? null,
        ref: t,
      }));
    const blks = dayBlocks
      .filter((b) => isAllDay(b.startTime, b.endTime))
      .map((b) => ({
        kind: "block" as const,
        id: b.id,
        title: b.title,
        color: colorForBlock(b),
        other: null,
        ref: b,
      }));
    return [...tasks, ...blks];
  }, [dayTasks, dayBlocks, colorForTask, colorForBlock, otherSemesterLabel]);

  const timedTasks = useMemo(
    () => dayTasks.filter((t) => t.startTime && t.endTime && !isAllDay(t.startTime, t.endTime)),
    [dayTasks]
  );
  const timedBlocks = useMemo(
    () => dayBlocks.filter((b) => !isAllDay(b.startTime, b.endTime)),
    [dayBlocks]
  );

  // Overlapping events are laid out the way Apple Calendar and Google
  // Calendar do it: a cluster of events that touch in time is packed into
  // columns, then each event widens into the free columns to its right. Two
  // events at the same hour take half the width each; one that only clashes
  // with the first of a pair still gets the rest of the row.
  type LayoutEntry = { col: number; cols: number; span: number };
  const overlapLayout = useMemo(() => {
    type Ev = { key: string; start: number; end: number; col: number };
    const evs: Ev[] = [
      ...timedTasks.map((t) => ({
        key: `task-${t.id}`,
        start: minutesFromStart(t.startTime!),
        end: minutesFromStart(t.endTime!),
        col: 0,
      })),
      ...timedBlocks.map((b) => ({
        key: `block-${b.id}`,
        start: minutesFromStart(b.startTime),
        end: minutesFromStart(b.endTime),
        col: 0,
      })),
    ];
    evs.sort((a, b) => a.start - b.start || b.end - a.end);

    const map = new Map<string, LayoutEntry>();
    const overlaps = (a: Ev, b: Ev) => a.start < b.end && b.start < a.end;

    // One cluster at a time: events are packed into the first column that is
    // free, then each one spans every further column it doesn't clash in.
    const place = (cluster: Ev[], cols: number) => {
      for (const e of cluster) {
        let span = 1;
        for (let c = e.col + 1; c < cols; c++) {
          if (cluster.some((o) => o.col === c && overlaps(e, o))) break;
          span++;
        }
        map.set(e.key, { col: e.col, cols, span });
      }
    };

    let cluster: Ev[] = [];
    let colEnds: number[] = [];
    let clusterEnd = -Infinity;
    for (const e of evs) {
      if (e.start >= clusterEnd) {
        if (cluster.length) place(cluster, colEnds.length);
        cluster = [];
        colEnds = [];
        clusterEnd = -Infinity;
      }
      let col = colEnds.findIndex((end) => end <= e.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(e.end);
      } else {
        colEnds[col] = e.end;
      }
      e.col = col;
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, e.end);
    }
    if (cluster.length) place(cluster, colEnds.length);
    return map;
  }, [timedTasks, timedBlocks]);

  /** Place one event inside its overlap cluster. */
  const slotLayout = (key: string): { style: React.CSSProperties; cls: string } => {
    const l = overlapLayout.get(key);
    if (!l || l.cols <= 1) return { style: {}, cls: "" };
    const unit = 100 / l.cols;
    return {
      style: {
        "--ev-left": `calc(${l.col * unit}% + 2px)`,
        "--ev-width": `calc(${l.span * unit}% - 4px)`,
        // Later columns sit above earlier ones, so a wider event that reaches
        // under its neighbour never covers it.
        zIndex: 3 + l.col,
      } as React.CSSProperties,
      cls: "rs-day-event-col",
    };
  };

  // Now-line position
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const isToday = dayDate === toIso(new Date());
  const nowPx =
    isToday && nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60
      ? ((nowMinutes - DAY_START_HOUR * 60) / 60) * PX_PER_HOUR
      : null;

  const gridRef = useRef<HTMLDivElement>(null);
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (autoScrolledRef.current) return;
    if (!gridRef.current || nowPx === null) return;
    gridRef.current.scrollTop = Math.max(0, nowPx - 100);
    autoScrolledRef.current = true;
  }, [nowPx]);

  const shiftDay = (delta: number) => {
    const d = new Date(dayDate);
    d.setDate(d.getDate() + delta);
    onChangeDayDate(toIso(d));
  };

  // ===== Drag / resize =====
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Mirror state into a ref so the window-level mousemove handler can read
  // the latest drag without re-binding on every render. Effect-bound so the
  // assignment doesn't mutate state during render (react-hooks/refs).
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
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
      const dur = endMin - startMin;
      startMin = Math.max(0, Math.min(startMin + snapped, totalDayMinutes - dur));
      endMin = startMin + dur;
    } else if (d.mode === "resize-bottom") {
      endMin = Math.max(startMin + DRAG_SNAP_MIN, Math.min(endMin + snapped, totalDayMinutes));
    } else {
      startMin = Math.min(endMin - DRAG_SNAP_MIN, Math.max(0, startMin + snapped));
    }
    const newStart = minutesToHHmm(startMin);
    const newEnd = minutesToHHmm(endMin);

    if (d.kind === "block") {
      const b = dayBlocks.find((x) => x.id === d.id);
      if (!b) return;
      onCommitBlockDrag({ block: b, newStart, newEnd });
    } else {
      const t = dayTasks.find((x) => x.id === d.id);
      if (!t) return;
      onCommitTaskDrag({ task: t, newStart, newEnd });
    }
  }, [dayBlocks, dayTasks, onCommitBlockDrag, onCommitTaskDrag]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const dy = e.clientY - cur.startY;
      const snappedMin = snapMin(Math.round(pxToMin(dy)));
      if (Math.abs(dy) > 3) movedRef.current = true;
      if (snappedMin !== cur.deltaMin) {
        setDrag({ ...cur, deltaMin: snappedMin });
      }
    };
    const onUp = () => {
      const cur = dragRef.current;
      flushSync(() => {
        if (cur && movedRef.current && cur.deltaMin !== 0) commitDrag(cur);
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

  // Pixel offsets + display times for the dragged event.
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
    const totalMin = Math.floor((y / PX_PER_HOUR) * 60);
    const snapped = Math.floor(totalMin / SLOT_MIN) * SLOT_MIN;
    const startMin = DAY_START_HOUR * 60 + snapped;
    const endMin = startMin + 60;
    const hh = (n: number) => String(Math.floor(n / 60)).padStart(2, "0");
    const mm = (n: number) => String(n % 60).padStart(2, "0");
    onSlotDblClick({
      date: dayDate,
      start: `${hh(startMin)}:${mm(startMin)}`,
      end: `${hh(Math.min(endMin, DAY_END_HOUR * 60))}:${mm(Math.min(endMin, DAY_END_HOUR * 60))}`,
    });
  };

  const hourLabels: string[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    hourLabels.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <>
      <header className="rs-day-head">
        {/* Same header as the month calendar: bold title with the date
            stepping back (opens the picker), chevrons around Today. */}
        <div className="rs-day-row">
          <DatePicker value={dayDate} onChange={(v) => v && onChangeDayDate(v)}>
            {(open) => (
              <button type="button" className="rs-day-date" onClick={open} title={longDay(dayDate)}>
                <span className="rs-day-date-wd">
                  {new Date(dayDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}
                </span>
                <span className="rs-day-date-md">
                  {new Date(dayDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </button>
            )}
          </DatePicker>
          <div className="rs-day-nav">
            <button className="rs-day-nav-btn" onClick={() => shiftDay(-1)} aria-label="Previous day"><ChevronLeft size={18} strokeWidth={2.5} /></button>
            <button
              className="rs-day-today"
              onClick={() => {
                const t = toIso(new Date());
                onChangeDayDate(t);
                window.dispatchEvent(new CustomEvent("oplanner:select-day", { detail: { date: t } }));
              }}
            >Today</button>
            <button className="rs-day-nav-btn" onClick={() => shiftDay(1)} aria-label="Next day"><ChevronRight size={18} strokeWidth={2.5} /></button>
          </div>
        </div>
        {/* Same scope row as the Upcoming tab. */}
        <div className="rs-scope-row">
          <span className="rs-eyebrow">
            {dayTasks.length + dayBlocks.length === 0
              ? "Nothing scheduled"
              : `${dayTasks.length + dayBlocks.length} ${dayTasks.length + dayBlocks.length === 1 ? "item" : "items"}`}
          </span>
          <span className="rs-count">Double-click to add</span>
        </div>
      </header>

      {/* All-day items get their own strip above the hour grid, the way Apple
          and Google Calendar show them: full rows that take no width from the
          timed events and stay put while the grid scrolls under them. */}
      {allDayItems.length > 0 && (
        <div className="rs-day-allday">
          <span className="rs-day-allday-label">All-day</span>
          <div className="rs-day-allday-list">
            {allDayItems.map((it) => {
              const accent = it.color ?? "#1db954";
              return (
                <button
                  key={`allday-${it.kind}-${it.id}`}
                  type="button"
                  dir={hasHebrew(it.title) ? "rtl" : "ltr"}
                  className="rs-day-allday-chip"
                  style={{
                    background: hexToRgba(accent, 0.3),
                    borderInlineStartColor: accent,
                  }}
                  title={it.other ? `${it.title} (${it.other})` : it.title}
                  onClick={() => {
                    if (it.kind === "task") onTaskClick(it.ref as HomeworkEntry);
                    else onBlockClick(it.ref as TimeBlock);
                  }}
                >
                  {it.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                <>
                  <span className="rs-day-quarter-line" style={{ top: PX_PER_HOUR / 4 }} />
                  <span className="rs-day-half-line" style={{ top: PX_PER_HOUR / 2 }} />
                  <span className="rs-day-quarter-line" style={{ top: (PX_PER_HOUR * 3) / 4 }} />
                </>
              )}
            </div>
          ))}

          <div
            className="rs-day-canvas"
            onDoubleClick={handleSlotDblClick}
            style={{ height: totalDayPx }}
          >
            {timedTasks.map((t) => {
              const sMin = minutesFromStart(t.startTime!);
              const eMin = minutesFromStart(t.endTime!);
              const { top, height, startHHmm, endHHmm } = dragPreview("task", t.id, sMin, eMin);
              const isDragging = drag?.kind === "task" && drag.id === t.id;
              const compact = height < 36;
              const accent = colorForTask(t);
              const slot = slotLayout(`task-${t.id}`);
              return (
                <div
                  key={`task-${t.year}-${t.course}-${t.id}`}
                  dir={hasHebrew(t.name) || hasHebrew(t.course) ? "rtl" : "ltr"}
                  className={`rs-day-event rs-day-event-task ${slot.cls} ${isDragging ? "rs-day-event-dragging" : ""} ${compact ? "rs-day-event-compact" : ""}`}
                  title={semesterOf(t) ? `${t.name} (${semesterOf(t)})` : undefined}
                  tabIndex={0}
                  style={{
                    top,
                    height,
                    background: hexToRgba(accent, 0.45),
                    borderInlineStartColor: accent,
                    color: accent,
                    ...slot.style,
                  }}
                  onMouseDown={(e) => beginDrag(e, "task", t.id, "move", t.startTime!, t.endTime!)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onTaskClick(t);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (movedRef.current) return;
                    onTaskClick(t);
                  }}
                >
                  <div
                    className="rs-day-event-resize rs-day-event-resize-top"
                    onMouseDown={(e) => beginDrag(e, "task", t.id, "resize-top", t.startTime!, t.endTime!)}
                  />
                  {compact ? (
                    <div className="rs-day-event-compact-row">
                      <span className="rs-day-event-title">{t.name}</span>
                      <span className="rs-day-event-meta" dir="ltr">{startHHmm}–{endHHmm}</span>
                    </div>
                  ) : (
                    <>
                      <div className="rs-day-event-title">{t.name}</div>
                      <div className="rs-day-event-meta">
                        {/* Times read left to right even in a Hebrew row. */}
                        <bdi dir="ltr">{startHHmm}–{endHHmm}</bdi> · {capitalizeWords(t.course)}
                      </div>
                    </>
                  )}
                  <div
                    className="rs-day-event-resize rs-day-event-resize-bottom"
                    onMouseDown={(e) => beginDrag(e, "task", t.id, "resize-bottom", t.startTime!, t.endTime!)}
                  />
                </div>
              );
            })}

            {timedBlocks.map((b) => {
              const sMin = minutesFromStart(b.startTime);
              const eMin = minutesFromStart(b.endTime);
              const { top, height, startHHmm, endHHmm } = dragPreview("block", b.id, sMin, eMin);
              const isDragging = drag?.kind === "block" && drag.id === b.id;
              const accent = colorForBlock(b);
              const compact = height < 36;
              const slot = slotLayout(`block-${b.id}`);
              return (
                <div
                  key={`block-${b.id}`}
                  dir={hasHebrew(b.title) ? "rtl" : "ltr"}
                  className={`rs-day-event rs-day-event-block ${slot.cls} ${isDragging ? "rs-day-event-dragging" : ""} ${compact ? "rs-day-event-compact" : ""}`}
                  tabIndex={0}
                  style={{
                    top,
                    height,
                    background: hexToRgba(accent, 0.45),
                    borderInlineStartColor: accent,
                    color: accent,
                    ...slot.style,
                  }}
                  onMouseDown={(e) => beginDrag(e, "block", b.id, "move", b.startTime, b.endTime)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onBlockClick(b);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (movedRef.current) return;
                    onBlockClick(b);
                  }}
                >
                  <div
                    className="rs-day-event-resize rs-day-event-resize-top"
                    onMouseDown={(e) => beginDrag(e, "block", b.id, "resize-top", b.startTime, b.endTime)}
                  />
                  {compact ? (
                    <div className="rs-day-event-compact-row">
                      <span className="rs-day-event-title">{b.title}</span>
                      <span className="rs-day-event-meta" dir="ltr">{startHHmm}–{endHHmm}</span>
                    </div>
                  ) : (
                    <>
                      <div className="rs-day-event-title">{b.title}</div>
                      <div className="rs-day-event-meta">
                        <bdi dir="ltr">{startHHmm}–{endHHmm}</bdi>
                      </div>
                    </>
                  )}
                  <div
                    className="rs-day-event-resize rs-day-event-resize-bottom"
                    onMouseDown={(e) => beginDrag(e, "block", b.id, "resize-bottom", b.startTime, b.endTime)}
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
  );
};

export default DayPanel;
