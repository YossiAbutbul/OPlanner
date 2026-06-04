// In-app reminder engine helpers — desktop-only OS notifications fired while
// the app is open. No backend / push: the service worker is not involved.
//
// Two reminder families:
//   - "dated": exam countdown (7 days → exam day, once per calendar day) and
//     task "due tomorrow" (once). Keyed so they fire at most once per day/task.
//   - "timed": Outlook-style "starts in N min" before a task's startTime on its
//     due day. Fired by the interval scan while the app stays open.
import { lsCache } from "../hooks/useLocalStorageCache";
import { startOfDay, toIso } from "./dayCalendar";
import type { HomeworkEntry } from "../types/models";

const SHOWN_KEY = "oplanner.notif.shown";

export interface ReminderItem {
  key: string;                  // stable dedupe key (embeds date for daily ones)
  kind: "timed" | "dated";
  title: string;
  body: string;
}

// "YYYY-MM-DD" → local midnight Date.
const isoToMidnight = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Whole days from `fromMidnight` to the start of `targetIso` (can be negative).
const dayDiff = (fromMidnight: Date, targetIso: string): number =>
  Math.round((isoToMidnight(targetIso).getTime() - fromMidnight.getTime()) / 86400000);

// "YYYY-MM-DD" + "HH:mm" → local Date.
const isoTimeToDate = (iso: string, hhmm: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mi] = hhmm.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0, 0, 0);
};

// True on PC-like environments: fine pointer + wide viewport. Mobile/tablet are
// intentionally excluded — OS popups while the app is foregrounded add nothing
// there, and most usage is on desktop.
export const isDesktopEnv = (): boolean => {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return !coarse && window.innerWidth >= 768;
};

export const notificationsSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

// Resolve the green app icon to an absolute URL so the OS popup can load it
// regardless of the current route or deploy base path. pwa-icon.svg is the
// green rounded square with the white logo (Logo.svg is transparent line art).
const iconUrl = (): string | undefined => {
  try {
    return new URL("pwa-icon.svg", document.baseURI).href;
  } catch {
    return undefined;
  }
};

// Show a desktop notification. Prefers the service worker's showNotification()
// — the path WhatsApp Web / installed PWAs use, and the only one that works on
// some platforms — and falls back to the page-level Notification constructor.
export const fireNotification = async (
  title: string,
  body: string,
  tag: string
): Promise<boolean> => {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    tag,
    icon: iconUrl(),
    badge: iconUrl(),
    renotify: true, // re-alert even if a notification with this tag exists
  };
  // This feature only fires while the app is open on desktop, where the
  // page-level constructor shows a real OS banner. Prefer it; some platforms
  // (e.g. Android) throw on the constructor — fall back to the service worker.
  try {
    new Notification(title, options);
    return true;
  } catch {
    /* constructor unavailable — try the service worker below */
  }
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
};

// Build every reminder that is "live" at `now`, before dedupe. The caller
// filters out already-shown keys and fires what remains.
export const buildReminders = (input: {
  now: Date;
  tasks: HomeworkEntry[];
  finals: { course: string; finalDate: string }[];
  leadMinutes: number;
}): ReminderItem[] => {
  const { now, tasks, finals, leadMinutes } = input;
  const todayMid = startOfDay(now);
  const out: ReminderItem[] = [];

  // Exams: a single reminder the day before the final. Keyed without a date so
  // it fires at most once per course.
  for (const f of finals) {
    if (dayDiff(todayMid, f.finalDate) !== 1) continue;
    out.push({
      key: `exam|${f.course}`,
      kind: "dated",
      title: "Exam tomorrow",
      body: `${f.course} final exam`,
    });
  }

  for (const t of tasks) {
    if (t.status !== "PENDING") continue;
    if (t.id === "final-exam") continue; // exams come from `finals`, not tasks
    const days = dayDiff(todayMid, t.dueDate);

    // Date reminder: once, the day before it's due.
    if (days === 1) {
      out.push({ key: `due1|${t.id}`, kind: "dated", title: "Due tomorrow", body: t.name });
    }

    // Start reminder: on the due day, `leadMinutes` before startTime. Only
    // while now is within the lead window (skip if the start already passed —
    // the app was likely closed through it).
    if (t.startTime && days === 0) {
      const start = isoTimeToDate(t.dueDate, t.startTime);
      const fireAt = new Date(start.getTime() - leadMinutes * 60000);
      if (now >= fireAt && now <= start) {
        const minsLeft = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
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

type ShownMap = Record<string, string>; // reminder key → iso date it fired

// Load the fired-key map, pruning anything older than 30 days so it can't grow
// without bound across a long-running session.
export const loadShown = (now: Date): ShownMap => {
  const raw = lsCache.read<ShownMap>(SHOWN_KEY) ?? {};
  const cutoff = toIso(new Date(now.getTime() - 30 * 86400000));
  const out: ShownMap = {};
  let changed = false;
  for (const [k, v] of Object.entries(raw)) {
    if (v >= cutoff) out[k] = v;
    else changed = true;
  }
  if (changed) lsCache.write(SHOWN_KEY, out);
  return out;
};

export const markShown = (key: string, now: Date): void => {
  const map = lsCache.read<ShownMap>(SHOWN_KEY) ?? {};
  map[key] = toIso(now);
  lsCache.write(SHOWN_KEY, map);
};
