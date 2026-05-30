import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
  onTaskClick,
  onBlockClick,
  onSlotDblClick,
  onCommitTaskDrag,
  onCommitBlockDrag,
}) => {
  const allDayItems = useMemo(() => {
    const tasks = dayTasks
      .filter((t) => isAllDay(t.startTime, t.endTime))
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.name,
        color: colorForTask(t),
        ref: t,
      }));
    const blks = dayBlocks
      .filter((b) => isAllDay(b.startTime, b.endTime))
      .map((b) => ({
        kind: "block" as const,
        id: b.id,
        title: b.title,
        color: colorForBlock(b),
        ref: b,
      }));
    return [...tasks, ...blks];
  }, [dayTasks, dayBlocks, colorForTask, colorForBlock]);

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
    let colsArr: number[] = [];
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
        <div className="rs-day-row">
          <button className="rs-day-nav-btn" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
          <DatePicker value={dayDate} onChange={(v) => v && onChangeDayDate(v)} block>
            {(open) => (
              <button type="button" className="rs-day-date" onClick={open}>
                {longDay(dayDate)}
              </button>
            )}
          </DatePicker>
          <button className="rs-day-nav-btn" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
          <button
            className="rs-day-today"
            onClick={() => {
              const t = toIso(new Date());
              onChangeDayDate(t);
              window.dispatchEvent(new CustomEvent("oplanner:select-day", { detail: { date: t } }));
            }}
          >Today</button>
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
                    if (it.kind === "task") onTaskClick(it.ref as HomeworkEntry);
                    else onBlockClick(it.ref as TimeBlock);
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
                  onMouseDown={(e) => beginDrag(e, "task", t.id, "move", t.startTime!, t.endTime!)}
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
                  onMouseDown={(e) => beginDrag(e, "block", b.id, "move", b.startTime, b.endTime)}
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
