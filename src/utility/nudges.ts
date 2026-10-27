// Things the AI Assistant brings up on its own, worked out on the device
// (no model call): asking whether a task whose date just passed was done
// (exams aside: their date passing is the answer), and opening a new week with what's due in it. One at a time; each is
// shown until answered or closed.

import { countPhrase, isDone, isExam, type AlertTask } from "./studyAlerts";

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
  const open = tasks.filter((t) => !isDone(t) && t.dueDate);

  // The most recent miss first: it's the one most likely still fixable.
  const missed = open
    .filter((t) => !isExam(t) && t.dueDate < today && daysBetween(t.dueDate, today) <= LOOKBACK_DAYS)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .find((t) => !seen.has(`s|${t.id}|${t.dueDate}`));
  if (missed) {
    const ago = daysBetween(missed.dueDate, today);
    return {
      kind: "submitted",
      key: `s|${missed.id}|${missed.dueDate}`,
      text: `סיימת את ${missed.name} ב${missed.course}? התאריך היה ${ago === 1 ? "אתמול" : `ב-${dm(missed.dueDate)}`}.`,
      task: missed,
      catchUp: `עוד לא סיימתי את ${missed.name} ב${missed.course} (התאריך היה ${dm(missed.dueDate)}). תעזור לי להשלים?`,
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
        ? isExam(first)
          ? `שבוע חדש: מבחן ב${first.course} ${when}. נתכנן?`
          : `שבוע חדש: ${first.name} ב${first.course} ${when}. נתכנן?`
        : `שבוע חדש: ${countPhrase(due)} השבוע, הקרוב ${when}. נתכנן?`,
  };
};

export interface ReplyGroup {
  label?: string;
  options: string[];
}

const OPTIONS_LINE = /^\[\[([^\]\n]+)\]\]$/;

// Lines like "[[Days: Evenings | Weekend]]" at the end of a reply: buttons
// for the student's likely answers, one line per question asked. Returns
// the text without them.
export const splitQuickReplies = (text: string): { text: string; groups: ReplyGroup[] } => {
  const lines = text.trimEnd().split("\n");
  const groups: ReplyGroup[] = [];
  while (lines.length && OPTIONS_LINE.test(lines[lines.length - 1].trim())) {
    let body = OPTIONS_LINE.exec(lines.pop()!.trim())![1];
    let label: string | undefined;
    const colon = body.indexOf(":");
    if (colon > 0 && colon <= 24 && !body.slice(0, colon).includes("|")) {
      label = body.slice(0, colon).trim();
      body = body.slice(colon + 1);
    }
    const options = body
      .split("|")
      .map((r) => r.trim())
      .filter((r) => r.length > 0 && r.length <= 40)
      .slice(0, 5);
    if (options.length) groups.unshift({ ...(label ? { label } : {}), options });
  }
  if (!groups.length) return { text, groups: [] };
  return { text: lines.join("\n").trimEnd(), groups: groups.slice(0, 3) };
};
