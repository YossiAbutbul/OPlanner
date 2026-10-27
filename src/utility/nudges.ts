// Things the AI Assistant brings up on its own, worked out on the device
// (no model call): asking whether a task whose date just passed was handed
// in, and opening a new week with what's due in it. One at a time; each is
// shown until answered or closed.

import type { AlertTask } from "./studyAlerts";

export interface NudgeTask extends AlertTask {
  id: string;
}

export type Nudge =
  | { kind: "submitted"; key: string; text: string; task: NudgeTask; catchUp: string }
  | { kind: "week"; key: string; text: string };

const DAY_MS = 86_400_000;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / DAY_MS);

const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Only recent misses: older ones were most likely handled outside the app.
const LOOKBACK_DAYS = 14;

export const pickNudge = (tasks: NudgeTask[], now: Date, seen: ReadonlySet<string>): Nudge | null => {
  const today = ymd(now);
  const open = tasks.filter((t) => t.status !== "DONE" && t.dueDate);

  // The most recent miss first: it's the one most likely still fixable.
  const missed = open
    .filter((t) => t.dueDate < today && daysBetween(t.dueDate, today) <= LOOKBACK_DAYS)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .find((t) => !seen.has(`s|${t.id}|${t.dueDate}`));
  if (missed) {
    const ago = daysBetween(missed.dueDate, today);
    return {
      kind: "submitted",
      key: `s|${missed.id}|${missed.dueDate}`,
      text: `הגשת את ${missed.name} ב${missed.course}? ההגשה הייתה ${ago === 1 ? "אתמול" : `ב-${dm(missed.dueDate)}`}.`,
      task: missed,
      catchUp: `עוד לא הגשתי את ${missed.name} ב${missed.course} (ההגשה הייתה ב-${dm(missed.dueDate)}). תעזור לי להשלים?`,
    };
  }

  // A week starts on Sunday.
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekKey = `w|${ymd(sunday)}`;
  if (seen.has(weekKey)) return null;
  const due = open
    .filter((t) => t.dueDate >= today && daysBetween(today, t.dueDate) < 7)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!due.length) return null;
  const first = due[0];
  const when = first.dueDate === today ? "היום" : `ביום ${DAYS[new Date(`${first.dueDate}T00:00:00`).getDay()]}`;
  return {
    kind: "week",
    key: weekKey,
    text:
      due.length === 1
        ? `שבוע חדש: ${first.name} ב${first.course} להגשה ${when}. נתכנן?`
        : `שבוע חדש: ${due.length} הגשות השבוע, הראשונה ${when}. נתכנן?`,
  };
};

// "[[A | B | C]]" on the last line of a reply: buttons for the student's
// likely answers. Returns the text without it.
export const splitQuickReplies = (text: string): { text: string; replies: string[] } => {
  const m = /\n?[ \t]*\[\[([^\]\n]+)\]\][ \t]*$/.exec(text.trimEnd());
  if (!m) return { text, replies: [] };
  const replies = m[1]
    .split("|")
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && r.length <= 40)
    .slice(0, 4);
  return { text: text.trimEnd().slice(0, m.index).trimEnd(), replies };
};
