// Early warnings for the AI Assistant's empty screen, worked out on the
// device from the open semester's tasks and the Schedule (no model call):
// a deadline coming up with no study time planned for it, and days with
// several deadlines at once. Each comes with the message that asks the
// Assistant to help plan it.

export interface AlertTask {
  id?: string;
  study?: boolean; // a planned study session, not work to plan for
  name: string;
  course: string;
  dueDate: string; // YYYY-MM-DD
  status: string;
}

export interface AlertBlock {
  date: string;
  title: string;
  courseId?: string;
}

export interface StudyAlert {
  key: string;
  // Why it needs attention ("מחר · אין זמן לימוד"), shown small above the title.
  label: string;
  title: string;
  prompt: string;
}

const DAY_MS = 86_400_000;

// The planner stores finished tasks as COMPLETED; the Assistant says DONE.
export const isDone = (t: { status: string }) => t.status === "COMPLETED" || t.status === "DONE";

// A course's Final Exam task (id "final-exam"), or anything named as an
// exam: something to study for, not hand in.
export const isExam = (t: AlertTask) =>
  t.id === "final-exam" || /\b(exam|quiz|midterm)\b|מבחן|בחינה|בוחן/i.test(t.name);

// "2 משימות ומבחן": what's on a day or in a week, by kind. Not "הגשות":
// tasks are also recordings, readings and exams.
export const countPhrase = (list: AlertTask[]): string => {
  const exams = list.filter(isExam).length;
  const tasks = list.length - exams;
  const parts = [
    tasks === 1 ? "משימה אחת" : tasks > 1 ? `${tasks} משימות` : "",
    exams === 1 ? "מבחן" : exams > 1 ? `${exams} מבחנים` : "",
  ].filter(Boolean);
  return parts.join(" ו");
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / DAY_MS);

const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

const whenText = (days: number) => (days === 0 ? "היום" : days === 1 ? "מחר" : `בעוד ${days} ימים`);

// Imported lectures ("מפגש · course") are class time, not study time.
const isLecture = (b: AlertBlock) => b.title.trim().startsWith("מפגש");

// Blocks link to a course by name, or "year|semester|course" when imported.
const blockCourse = (b: AlertBlock) => (b.courseId ?? "").split("|").pop()!.toLowerCase();

// Study time for a task: a Schedule block, or a study session the Assistant
// planned (saved as a task), for its course or by its name, before it's due.
const plannedFor = (t: AlertTask, blocks: AlertBlock[], sessions: AlertTask[], today: string) =>
  sessions.some(
    (s) =>
      s.dueDate >= today &&
      s.dueDate <= t.dueDate &&
      (s.course.toLowerCase() === t.course.toLowerCase() || s.name.toLowerCase().includes(t.name.toLowerCase()))
  ) ||
  blocks.some((b) => {
    if (b.date < today || b.date > t.dueDate || isLecture(b)) return false;
    const title = b.title.toLowerCase();
    const course = t.course.toLowerCase();
    return blockCourse(b) === course || title.includes(course) || title.includes(t.name.toLowerCase());
  });

export const studyAlerts = (
  tasks: AlertTask[],
  blocks: AlertBlock[],
  now: Date,
  limit = 2
): StudyAlert[] => {
  const today = ymd(now);
  const upcoming = tasks.filter((t) => !isDone(t) && t.dueDate && t.dueDate >= today);
  // Study sessions are the plan, not work: never warned about themselves.
  const sessions = upcoming.filter((t) => t.study);
  const open = upcoming.filter((t) => !t.study);

  const unplanned = open
    .map((t) => ({ t, days: daysBetween(today, t.dueDate) }))
    .filter(({ t, days }) => days <= 5 && !plannedFor(t, blocks, sessions, today))
    .sort((a, b) => a.days - b.days)
    .map(
      ({ t, days }): StudyAlert => ({
        key: `u|${t.course}|${t.name}|${t.dueDate}`,
        label: `${whenText(days)} · אין זמן לימוד ביומן`,
        title: `${t.name} · ${t.course}`,
        prompt: isExam(t)
          ? `תעזור לי לתכנן זמן למידה למבחן ב${t.course} (ב-${dm(t.dueDate)})`
          : `תעזור לי לתכנן זמן ל${t.name} ב${t.course} (עד ${dm(t.dueDate)})`,
      })
    );

  const byDate = new Map<string, AlertTask[]>();
  for (const t of open) {
    if (daysBetween(today, t.dueDate) > 14) continue;
    byDate.set(t.dueDate, [...(byDate.get(t.dueDate) ?? []), t]);
  }
  const clashes = [...byDate.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([date, list]): StudyAlert => ({
        key: `c|${date}`,
        label: `${countPhrase(list)} ב-${dm(date)}`,
        title: [...new Set(list.map((t) => t.course))].join(", "),
        prompt: `יש לי ${countPhrase(list)} ב-${dm(date)}. תעזור לי לפרוס את העבודה?`,
      })
    );

  return [...unplanned, ...clashes].slice(0, limit);
};
