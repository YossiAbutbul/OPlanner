export type IcsCategory = "meeting" | "maman" | "mamach" | "other";

export interface IcsEvent {
  summary: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM or null (all-day)
  category: IcsCategory;
  course: string | null;
  courseNumber: string | null;
  semester: string | null; // "Semester A" | "Semester B" | "Semester C"
  year: number | null;
  taskNumber: string | null;
}

const unfold = (raw: string) =>
  raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");

const stripParam = (line: string) => {
  const colon = line.indexOf(":");
  if (colon === -1) return { key: "", value: "", params: "" };
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1).trim();
  const semi = head.indexOf(";");
  const key = (semi === -1 ? head : head.slice(0, semi)).trim().toUpperCase();
  const params = semi === -1 ? "" : head.slice(semi + 1).toUpperCase();
  return { key, value, params };
};

const parseDtStart = (
  value: string,
  params: string
): { date: string; time: string | null } => {
  const isDate = /VALUE=DATE\b/.test(params);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return { date: "", time: null };
  const [, y, mo, d, hh, mm] = m;
  return {
    date: `${y}-${mo}-${d}`,
    time: !isDate && hh && mm ? `${hh}:${mm}` : null,
  };
};

const SEM_MAP: Record<string, string> = {
  א: "Semester A",
  ב: "Semester B",
  ג: "Semester C",
};

const extractCourse = (description: string) => {
  // קורס שפות תכנות (20905) בסמסטר ב2026
  // שפות תכנות (20905) בסמסטר ב2026
  const re = /(?:קורס\s+)?(.+?)\s*\((\d+)\)\s*בסמסטר\s*([אבגדה])(\d{4})/;
  const m = description.match(re);
  if (!m) {
    return { course: null, courseNumber: null, semester: null, year: null };
  }
  return {
    course: m[1].trim(),
    courseNumber: m[2],
    semester: SEM_MAP[m[3]] || null,
    year: parseInt(m[4], 10),
  };
};

const extractTaskNumber = (description: string) => {
  const m = description.match(/מטלה\s*(\d+)/);
  return m ? m[1] : null;
};

const categorize = (summary: string): IcsCategory => {
  if (/מפגש/.test(summary)) return "meeting";
  if (/ממ["״]?ן/.test(summary)) return "maman";
  if (/ממ["״]?ח/.test(summary)) return "mamach";
  return "other";
};

export const parseIcs = (raw: string): IcsEvent[] => {
  const text = unfold(raw);
  const events: IcsEvent[] = [];
  const blocks = text.split(/BEGIN:VEVENT/).slice(1);
  for (const block of blocks) {
    const end = block.indexOf("END:VEVENT");
    const body = end === -1 ? block : block.slice(0, end);
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    let summary = "";
    let description = "";
    let location = "";
    let startDate = "";
    let startTime: string | null = null;

    for (const line of lines) {
      const { key, value, params } = stripParam(line);
      if (key === "SUMMARY") summary = value;
      else if (key === "DESCRIPTION") description = value;
      else if (key === "LOCATION") location = value;
      else if (key === "DTSTART") {
        const r = parseDtStart(value, params);
        startDate = r.date;
        startTime = r.time;
      }
    }

    if (!startDate) continue;

    const { course, courseNumber, semester, year } = extractCourse(description);
    events.push({
      summary,
      description,
      location,
      startDate,
      startTime,
      category: categorize(summary),
      course,
      courseNumber,
      semester,
      year,
      taskNumber: extractTaskNumber(description),
    });
  }
  return events;
};

export const buildTaskName = (e: IcsEvent): string => {
  if (e.category === "maman") return `מטלה ${e.taskNumber || "?"} (ממ"ן)`;
  if (e.category === "mamach") return `מטלה ${e.taskNumber || "?"} (ממ"ח)`;
  if (e.category === "meeting") {
    return e.startTime ? `מפגש ${e.startTime}` : "מפגש";
  }
  return e.summary || "Event";
};
