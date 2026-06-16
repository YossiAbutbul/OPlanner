// Pure time-math + format helpers for the Day-view calendar in RightSidebar.
// No React, no state, no DOM. Same constants exported so the panel and
// drag layer share the same grid scale.

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 24;
export const SLOT_MIN = 30;
export const PX_PER_HOUR = 64; // 32px per 30-min slot
export const DRAG_SNAP_MIN = 15;

export const totalDayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const totalDayPx = (totalDayMinutes / 60) * PX_PER_HOUR;

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const toIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export const capitalizeWords = (s: string): string =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

export const dayName = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short" });

export const longDay = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

export const daysLeft = (iso: string): number => {
  const due = startOfDay(new Date(iso));
  const now = startOfDay(new Date());
  return Math.round((due.getTime() - now.getTime()) / 86400000);
};

export const urgencyClass = (d: number): "danger" | "warn" | "ok" => {
  if (d <= 5) return "danger";
  if (d <= 10) return "warn";
  return "ok";
};

export interface TimeLeft {
  /** Numeric count for the compact pip (minutes or days). Omitted for today/overdue. */
  num: number;
  /** Unit word for the pip's second line. Empty for today/overdue. */
  unit: "" | "min" | "day" | "days";
  /** Compact label, e.g. "today", "5h", "3 days". */
  short: string;
  /** Sentence fragment, e.g. "today", "in 5 hours", "in 3 days". */
  text: string;
  /** Raw whole-days delta — drives urgency colors. */
  days: number;
}

// The exact moment a task is due. With a clock time, that time on the due
// date; without, the end of the due day (so a date-only task is overdue only
// once the whole day has passed). `time` is "HH:MM" — pass endTime else startTime.
export const dueMoment = (iso: string, time?: string): Date => {
  const [y, mo, d] = iso.split("-").map(Number);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    return new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
  }
  return new Date(y, (mo || 1) - 1, d || 1, 23, 59, 59, 999);
};

// True once the due moment has passed. Caller still gates on status/ignoreOverdue.
export const isOverdue = (iso: string, time?: string, now: Date = new Date()): boolean =>
  dueMoment(iso, time).getTime() < now.getTime();

// Time remaining until a task is due. Past-due → "overdue". A same-day task
// stays "today" until under an hour out, then counts down in minutes ("12m");
// future days show whole days. `time` is "HH:MM" (the deadline — endTime, else
// startTime).
export const timeLeft = (iso: string, time?: string): TimeLeft => {
  const days = daysLeft(iso);
  const now = Date.now();
  const dueMs = dueMoment(iso, time).getTime();
  if (dueMs < now) {
    return { num: 0, unit: "", short: "overdue", text: "overdue", days };
  }
  if (days === 0 && time) {
    const minutes = Math.ceil((dueMs - now) / 60_000);
    if (minutes < 60) {
      return {
        num: minutes,
        unit: "min",
        short: `${minutes}m`,
        text: `in ${minutes} min`,
        days,
      };
    }
    return { num: 0, unit: "", short: "today", text: "today", days };
  }
  if (days === 0) {
    return { num: 0, unit: "", short: "today", text: "today", days };
  }
  const unit = days === 1 ? "day" : "days";
  return { num: days, unit, short: `${days} ${unit}`, text: `in ${days} ${unit}`, days };
};

export const minutesFromStart = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h - DAY_START_HOUR) * 60 + m;
};

export const minutesToHHmm = (mins: number): string => {
  const abs = Math.max(0, Math.min(mins, totalDayMinutes));
  const total = abs + DAY_START_HOUR * 60;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const snapMin = (m: number): number => Math.round(m / DRAG_SNAP_MIN) * DRAG_SNAP_MIN;
export const pxToMin = (px: number): number => (px * 60) / PX_PER_HOUR;

// All-day = explicit 07:00-23:00, legacy 00:00-23:59, or no times at all.
export const isAllDay = (s?: string, e?: string): boolean =>
  (s === "07:00" && e === "23:00") ||
  (s === "00:00" && e === "23:59") ||
  !s ||
  !e;

export const hexToRgba = (hex: string, alpha: number): string => {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
