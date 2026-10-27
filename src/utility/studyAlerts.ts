// Early warnings for the AI Assistant's empty screen, worked out on the
// device from the open semester's tasks and the Schedule (no model call):
// a deadline coming up with no study time planned for it, and days with
// several deadlines at once. Each comes with the message that asks the
// Assistant to help plan it.

export interface AlertTask {
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

const plannedFor = (t: AlertTask, blocks: AlertBlock[], today: string) =>
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
  const open = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate >= today);

  const unplanned = open
    .map((t) => ({ t, days: daysBetween(today, t.dueDate) }))
    .filter(({ t, days }) => days <= 5 && !plannedFor(t, blocks, today))
    .sort((a, b) => a.days - b.days)
    .map(
      ({ t, days }): StudyAlert => ({
        key: `u|${t.course}|${t.name}|${t.dueDate}`,
        label: `${whenText(days)} · אין זמן לימוד ביומן`,
        title: `${t.name} · ${t.course}`,
        prompt: `תעזור לי לתכנן זמן ל${t.name} ב${t.course} (הגשה ב-${dm(t.dueDate)})`,
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
        label: `${list.length} הגשות ב-${dm(date)}`,
        title: [...new Set(list.map((t) => t.course))].join(", "),
        prompt: `יש לי ${list.length} הגשות ב-${dm(date)}. תעזור לי לפרוס את העבודה עליהן?`,
      })
    );

  return [...unplanned, ...clashes].slice(0, limit);
};
