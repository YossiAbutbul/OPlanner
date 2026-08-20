// Pure week-math for the semester Weekly Report. No React, no Firestore.
// Takes the semester's tasks plus the user's time blocks and folds them into
// one week's worth of numbers. Weeks run Sunday→Saturday, matching
// CourseCalendar's grid.

import type { CourseInfo, HomeworkEntry, TimeBlock } from "../types/models";
import { dueMoment, isAllDay, isOverdue, startOfDay, toIso } from "./dayCalendar";

export const COMPLETED = "COMPLETED";
export const PENDING = "PENDING";

/** Bucket for time that belongs to no course in this semester. */
export const PERSONAL_BUCKET = "Personal & reminders";

export interface CourseTime {
  course: string;
  minutes: number;
  pct: number;
  /** Tasks due this week for this course, and how many of them are done. */
  due: number;
  done: number;
}

export interface DayCell {
  iso: string;
  /** "Sun" … "Sat" */
  label: string;
  minutes: number;
  completed: number;
}

export interface OverdueItem {
  task: HomeworkEntry;
  daysOver: number;
}

export interface ExamItem {
  course: string;
  date: string;
  daysLeft: number;
}

export interface WeekTotals {
  completed: number;
  minutes: number;
  onTimePct: number | null;
}

/** One bar in the trend strip. */
export interface TrendWeek extends WeekTotals {
  weekStart: string;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  /** True when the week contains today. */
  isCurrent: boolean;

  /** Tasks stamped COMPLETED inside the week. */
  completed: number;
  /** Tasks whose due date falls inside the week. */
  due: number;
  /** …of those, how many are COMPLETED now. */
  dueDone: number;
  completionPct: number;

  onTime: number;
  late: number;
  unfinished: number;
  early: number;
  /** Completions that carry a stamp, so their punctuality is known. */
  tracked: number;
  /**
   * True when the on-time split covers enough of the week's work to mean
   * something: at least one stamped completion, and stamped ones not
   * outnumbered by untracked ones.
   */
  onTimeReliable: boolean;
  /** null when nothing in the week can be judged (no stamped completions). */
  onTimePct: number | null;
  /** Tasks finished but saved before completedAt existed; excluded from on-time math. */
  unstamped: number;
  lateMinutes: number;
  avgLateMinutes: number;

  minutes: number;
  byCourse: CourseTime[];
  byDay: DayCell[];
  bestDay: DayCell | null;
  longestBlock: { minutes: number; iso: string; label: string } | null;

  overdue: OverdueItem[];
  overdueDays: number;

  /** Open tasks due from today through the next seven days, soonest first. */
  upcoming: HomeworkEntry[];
  nextWeekDue: DayCell[];
  nextWeekTotal: number;
  exams: ExamItem[];

  prev: WeekTotals;
  delta: WeekTotals;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sunday of the week containing `d`, at 00:00 local. */
export const weekStartOf = (d: Date): Date => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

export const shiftWeeks = (weekStartIso: string, weeks: number): string => {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const x = new Date(y, (m || 1) - 1, d || 1);
  x.setDate(x.getDate() + weeks * 7);
  return toIso(x);
};

/** The seven ISO dates of the week starting at `weekStartIso`. */
export const weekDays = (weekStartIso: string): string[] => {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(y, (m || 1) - 1, (d || 1) + i);
    return toIso(x);
  });
};

/** "10–16 Aug 2026" / "28 Sep – 4 Oct 2026" */
export const weekLabel = (weekStartIso: string): string => {
  const days = weekDays(weekStartIso);
  const a = new Date(days[0]);
  const b = new Date(days[6]);
  const mon = (x: Date) => x.toLocaleDateString(undefined, { month: "short" });
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth
    ? `${a.getDate()}–${b.getDate()} ${mon(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)} ${b.getFullYear()}`;
};

/** 95 → "1h 35m", 0 → "0m" */
export const fmtMinutes = (min: number): string => {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/** 55 → "2d 7h" for lateness spans, which read better in days. */
export const fmtSpan = (min: number): string => {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  if (hours < 24) return fmtMinutes(rounded);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
};

const minutesBetween = (start?: string, end?: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
};

/** Scheduled minutes a task represents. All-day / untimed tasks count 0. */
export const taskMinutes = (t: HomeworkEntry): number =>
  isAllDay(t.startTime, t.endTime) ? 0 : minutesBetween(t.startTime, t.endTime);

/** Scheduled minutes a block represents. */
export const blockMinutes = (b: TimeBlock): number =>
  isAllDay(b.startTime, b.endTime) ? 0 : minutesBetween(b.startTime, b.endTime);

/**
 * Minutes a completion missed its deadline by. Negative means early.
 * Returns null when the task carries no completedAt stamp.
 */
export const latenessMinutes = (t: HomeworkEntry): number | null => {
  if (!t.completedAt) return null;
  const done = new Date(t.completedAt).getTime();
  if (Number.isNaN(done)) return null;
  return (done - dueMoment(t.dueDate, t.endTime ?? t.startTime).getTime()) / 60_000;
};

const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;


/**
 * The day a task counts as finished on. Stamped tasks use their real instant;
 * tasks completed before completedAt existed fall back to their due date, so
 * older weeks still show work instead of a row of zeros. Fallback days are
 * counted as done but never judged on-time (see `unstamped`).
 */
export const completedIso = (t: HomeworkEntry): string | null => {
  if (t.completedAt) {
    const d = new Date(t.completedAt);
    if (!Number.isNaN(d.getTime())) return toIso(d);
  }
  return t.status === COMPLETED ? t.dueDate : null;
};

const emptyDays = (isos: string[]): DayCell[] =>
  isos.map((iso) => ({
    iso,
    label: WEEKDAYS[new Date(iso).getDay()],
    minutes: 0,
    completed: 0,
  }));

interface Input {
  tasks: HomeworkEntry[];
  blocks: TimeBlock[];
  courses: CourseInfo[];
  weekStart: string;
  now?: Date;
}

/** Headline counters for one week. Also used to compute the previous week. */
const weekTotals = (
  tasks: HomeworkEntry[],
  blocks: TimeBlock[],
  weekStart: string
): WeekTotals => {
  const days = weekDays(weekStart);
  const from = days[0];
  const to = days[6];

  let completed = 0;
  let onTime = 0;
  let judged = 0;
  let minutes = 0;

  for (const t of tasks) {
    const doneIso = completedIso(t);
    if (doneIso && inRange(doneIso, from, to)) {
      completed += 1;
      const late = latenessMinutes(t);
      if (late !== null) {
        judged += 1;
        if (late <= 0) onTime += 1;
      }
    }
    if (inRange(t.dueDate, from, to)) minutes += taskMinutes(t);
  }
  for (const b of blocks) {
    if (inRange(b.date, from, to)) minutes += blockMinutes(b);
  }

  return {
    completed,
    minutes,
    onTimePct: judged > 0 ? Math.round((onTime / judged) * 100) : null,
  };
};

/**
 * Fold one semester's tasks and the user's time blocks into a single week's
 * report. `tasks` should already be scoped to the semester (all courses plus
 * the synthetic "reminders" course); `blocks` is the full block list; blocks
 * are matched to the semester by course name, and unassigned ones land in the
 * personal bucket.
 */
export const buildWeeklyReport = ({
  tasks,
  blocks,
  courses,
  weekStart,
  now = new Date(),
}: Input): WeeklyReport => {
  const days = weekDays(weekStart);
  const from = days[0];
  const to = days[6];
  const todayIso = toIso(now);
  const courseNames = new Set(courses.map((c) => c.name));

  const byDay = emptyDays(days);
  const dayIndex = new Map(byDay.map((d, i) => [d.iso, i]));
  const courseMinutes = new Map<string, number>();
  const courseDue = new Map<string, { due: number; done: number }>();
  const bumpCourse = (course: string, done: boolean) => {
    const key = courseNames.has(course) ? course : PERSONAL_BUCKET;
    const cur = courseDue.get(key) ?? { due: 0, done: 0 };
    cur.due += 1;
    if (done) cur.done += 1;
    courseDue.set(key, cur);
  };
  const addCourseMinutes = (course: string, mins: number) => {
    if (mins <= 0) return;
    const key = courseNames.has(course) ? course : PERSONAL_BUCKET;
    courseMinutes.set(key, (courseMinutes.get(key) ?? 0) + mins);
  };

  let completed = 0;
  let due = 0;
  let dueDone = 0;
  let onTime = 0;
  let late = 0;
  let early = 0;
  let unstamped = 0;
  let lateMinutes = 0;
  let minutes = 0;
  let longestBlock: WeeklyReport["longestBlock"] = null;

  const overdue: OverdueItem[] = [];

  for (const t of tasks) {
    // Work done inside the week, keyed on when it was finished.
    const doneIso = completedIso(t);
    if (doneIso && inRange(doneIso, from, to)) {
      completed += 1;
      const idx = dayIndex.get(doneIso);
      if (idx !== undefined) byDay[idx].completed += 1;
      const lateBy = latenessMinutes(t);
      if (lateBy === null) {
        unstamped += 1;
      } else if (lateBy > 0) {
        late += 1;
        lateMinutes += lateBy;
      } else {
        onTime += 1;
        if (lateBy < -60) early += 1; // finished more than an hour ahead
      }
    }

    // Deadlines that landed inside the week: the "did you keep up" side.
    if (inRange(t.dueDate, from, to)) {
      due += 1;
      bumpCourse(t.course, t.status === COMPLETED);
      if (t.status === COMPLETED) dueDone += 1;
      const mins = taskMinutes(t);
      if (mins > 0) {
        minutes += mins;
        addCourseMinutes(t.course, mins);
        const idx = dayIndex.get(t.dueDate);
        if (idx !== undefined) byDay[idx].minutes += mins;
      }
    }

    // Open past their moment, as of `now`. Not week-bound.
    if (
      t.status === PENDING &&
      !t.ignoreOverdue &&
      isOverdue(t.dueDate, t.endTime ?? t.startTime, now)
    ) {
      const over = Math.max(
        0,
        Math.round((startOfDay(now).getTime() - startOfDay(new Date(t.dueDate)).getTime()) / DAY_MS)
      );
      overdue.push({ task: t, daysOver: over });
    }
  }

  for (const b of blocks) {
    if (!inRange(b.date, from, to)) continue;
    const mins = blockMinutes(b);
    if (mins <= 0) continue;
    minutes += mins;
    addCourseMinutes(b.courseId ?? PERSONAL_BUCKET, mins);
    const idx = dayIndex.get(b.date);
    if (idx !== undefined) byDay[idx].minutes += mins;
    if (!longestBlock || mins > longestBlock.minutes) {
      longestBlock = { minutes: mins, iso: b.date, label: b.title };
    }
  }

  // Every course that either took time or had a deadline this week.
  const courseKeys = new Set([...courseMinutes.keys(), ...courseDue.keys()]);
  const byCourse: CourseTime[] = [...courseKeys]
    .map((course) => {
      const mins = courseMinutes.get(course) ?? 0;
      const counts = courseDue.get(course) ?? { due: 0, done: 0 };
      return {
        course,
        minutes: mins,
        pct: minutes > 0 ? Math.round((mins / minutes) * 100) : 0,
        due: counts.due,
        done: counts.done,
      };
    })
    .sort((a, b) => b.minutes - a.minutes || b.due - a.due);

  const unfinished = Math.max(0, due - dueDone);
  const judged = onTime + late;
  const onTimeReliable = judged > 0 && unstamped <= judged;
  const bestDay = byDay.reduce<DayCell | null>(
    (best, d) => (d.minutes > (best?.minutes ?? 0) ? d : best),
    null
  );

  // Next week's shape: load per day plus finals still ahead.
  const nextStart = shiftWeeks(weekStart, 1);
  const nextDays = weekDays(nextStart);
  const nextWeekDue = emptyDays(nextDays);
  const nextIndex = new Map(nextWeekDue.map((d, i) => [d.iso, i]));
  let nextWeekTotal = 0;
  for (const t of tasks) {
    if (t.status === COMPLETED) continue;
    const idx = nextIndex.get(t.dueDate);
    if (idx === undefined) continue;
    nextWeekDue[idx].completed += 1;
    nextWeekTotal += 1;
  }

  const horizon = toIso(new Date(startOfDay(now).getTime() + 7 * DAY_MS));
  const upcoming = tasks
    .filter((t) => t.status !== COMPLETED && t.dueDate >= todayIso && t.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));

  const exams: ExamItem[] = courses
    .filter((c) => !!c.finalDate)
    .map((c) => ({
      course: c.name,
      date: c.finalDate as string,
      daysLeft: Math.round(
        (startOfDay(new Date(c.finalDate as string)).getTime() - startOfDay(now).getTime()) / DAY_MS
      ),
    }))
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const prev = weekTotals(tasks, blocks, shiftWeeks(weekStart, -1));
  const current: WeekTotals = {
    completed,
    minutes,
    onTimePct: judged > 0 ? Math.round((onTime / judged) * 100) : null,
  };

  return {
    weekStart: from,
    weekEnd: to,
    isCurrent: inRange(todayIso, from, to),

    completed,
    due,
    dueDone,
    completionPct: due > 0 ? Math.round((dueDone / due) * 100) : 0,

    onTime,
    late,
    unfinished,
    early,
    tracked: judged,
    onTimeReliable,
    onTimePct: current.onTimePct,
    unstamped,
    lateMinutes,
    avgLateMinutes: late > 0 ? lateMinutes / late : 0,

    minutes,
    byCourse,
    byDay,
    bestDay: bestDay && bestDay.minutes > 0 ? bestDay : null,
    longestBlock,

    overdue: overdue.sort((a, b) => b.daysOver - a.daysOver),
    overdueDays: overdue.reduce((sum, o) => sum + o.daysOver, 0),

    upcoming,
    nextWeekDue,
    nextWeekTotal,
    exams,

    prev,
    delta: {
      completed: completed - prev.completed,
      minutes: minutes - prev.minutes,
      onTimePct:
        current.onTimePct !== null && prev.onTimePct !== null
          ? current.onTimePct - prev.onTimePct
          : null,
    },
  };
};

/**
 * The last `count` weeks ending at `weekStart`, oldest first. Feeds the trend
 * strip so a single week reads against the ones before it.
 */
export const weeklyTrend = (
  tasks: HomeworkEntry[],
  blocks: TimeBlock[],
  weekStart: string,
  count = 6
): TrendWeek[] =>
  Array.from({ length: count }, (_, i) => {
    const start = shiftWeeks(weekStart, i - (count - 1));
    return { weekStart: start, ...weekTotals(tasks, blocks, start) };
  });
