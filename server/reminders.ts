// Server-side reminder rules for Web Push (api/send-reminders.ts). Mirrors
// buildReminders in src/utility/notifications.ts (the in-tab engine); keep the
// two in step.
//
// Differences from the client, both because the server isn't driven by the
// user opening the app:
//   - Everything runs on the device's wall clock (its IANA time zone), held
//     in a Date whose UTC fields are the local time. Only UTC getters are used.
//   - "Dated" reminders (due tomorrow / exam tomorrow) wait until DATED_HOUR
//     local the evening before, instead of firing the moment the app opens.
//     Keys embed the date so a rescheduled task reminds again.

export interface TaskInput {
  id: string;
  name: string;
  dueDate: string;     // YYYY-MM-DD
  startTime?: string;  // HH:mm
}

export interface FinalInput {
  course: string;
  finalDate: string;   // YYYY-MM-DD
}

export interface Reminder {
  key: string;
  kind: "timed" | "dated";
  title: string;
  body: string;
}

export interface PushMessage {
  title: string;
  body: string;
  tag: string;
}

export const DATED_HOUR = 18;

const DAY_MS = 86400000;

const isoOf = (d: Date): string => d.toISOString().slice(0, 10);

const isoToUtcMs = (iso: string, hhmm = "00:00"): number => {
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mi] = hhmm.split(":").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mi || 0);
};

// `now` as wall-clock time in `tz`, expressed in UTC fields. Throws
// RangeError on an unknown zone.
export const wallClock = (now: Date, tz: string): Date => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  );
};

// Every date that can be "today" or "tomorrow" somewhere on Earth at `now`
// (zones span UTC-12..UTC+14). Bounds the Firestore query.
export const candidateDates = (now: Date): string[] =>
  [-1, 0, 1, 2].map((off) => isoOf(new Date(now.getTime() + off * DAY_MS)));

export const buildReminders = (input: {
  wall: Date;
  tasks: TaskInput[];
  finals: FinalInput[];
  leadMinutes: number;
}): Reminder[] => {
  const { wall, tasks, finals, leadMinutes } = input;
  const todayMs = isoToUtcMs(isoOf(wall));
  const dayDiff = (iso: string) => Math.round((isoToUtcMs(iso) - todayMs) / DAY_MS);
  const datedOpen = wall.getUTCHours() >= DATED_HOUR;
  const out: Reminder[] = [];

  if (datedOpen) {
    for (const f of finals) {
      if (dayDiff(f.finalDate) !== 1) continue;
      out.push({
        key: `exam|${f.course}|${f.finalDate}`,
        kind: "dated",
        title: "Exam tomorrow",
        body: `${f.course} final exam`,
      });
    }
  }

  for (const t of tasks) {
    if (t.id === "final-exam") continue; // exams come from `finals`
    const days = dayDiff(t.dueDate);

    if (datedOpen && days === 1) {
      out.push({
        key: `due1|${t.id}|${t.dueDate}`,
        kind: "dated",
        title: "Due tomorrow",
        body: t.name,
      });
    }

    if (t.startTime && days === 0) {
      const start = isoToUtcMs(t.dueDate, t.startTime);
      const fireAt = start - leadMinutes * 60000;
      const nowMs = wall.getTime();
      if (nowMs >= fireAt && nowMs <= start) {
        const minsLeft = Math.max(0, Math.round((start - nowMs) / 60000));
        out.push({
          key: `start|${t.id}|${t.dueDate}`,
          kind: "timed",
          title: minsLeft <= 0 ? "Starting now" : `Starts in ${minsLeft} min`,
          body: minsLeft <= 0 ? `${t.name} starting now` : `${t.name} at ${t.startTime}`,
        });
      }
    }
  }

  return out;
};

// Turn fresh (not yet sent) reminders into notifications. Timed ones go out
// individually; more than two dated ones collapse into one summary so an
// evening with many deadlines doesn't spray popups.
export const planMessages = (fresh: Reminder[], todayIso: string): PushMessage[] => {
  const out: PushMessage[] = fresh
    .filter((r) => r.kind === "timed")
    .map((r) => ({ title: r.title, body: r.body, tag: r.key }));
  const dated = fresh.filter((r) => r.kind === "dated");
  if (dated.length <= 2) {
    out.push(...dated.map((r) => ({ title: r.title, body: r.body, tag: r.key })));
  } else {
    out.push({
      title: `${dated.length} upcoming deadlines`,
      body: dated.map((r) => r.body).slice(0, 4).join(", "),
      tag: `summary|${todayIso}`,
    });
  }
  return out;
};

// Push endpoints come from client-written docs; only POST to known push
// services so a crafted doc can't point the function at arbitrary hosts.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export const isAllowedEndpoint = (endpoint: unknown): endpoint is string => {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
};
