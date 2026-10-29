import React, { useMemo, useState } from "react";
import { Check, Info } from "lucide-react";
import Modal from "./Modal";
import { IcsEvent, buildTaskName } from "../utility/parseIcs";
import { useHomework } from "../context/HomeworkContext";
import { useTimeBlocks } from "../context/TimeBlockContext";
import { useToast } from "../context/ToastContext";
import { initializeYear, addCourse } from "../utility/initializeDatabase";
import { IMPORTED_TASK_PREFIX } from "../services/homework";
import { isSafeSegment } from "../utility/firestorePath";
import type { TimeBlock } from "../types/models";
import "../css/ImportCalendarModal.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: IcsEvent[];
  onDone: () => void;
}

// What an event becomes. Assignments are tasks in their course; meetings
// (lectures) are timed blocks in the Schedule; academic dates (semester
// start/end, registration, no course) are all-day Schedule blocks.
type Group = "maman" | "mamach" | "meeting" | "academic" | "other";

const groupOf = (e: IcsEvent): Group =>
  e.category === "other" ? (e.course ? "other" : "academic") : e.category;

const TASK_GROUPS: Group[] = ["maman", "mamach", "other"];

const GROUPS: { key: Group; name: string; dest: string }[] = [
  { key: "maman", name: "Assignments", dest: "Tasks" },
  { key: "mamach", name: "Computer assignments", dest: "Tasks" },
  { key: "meeting", name: "Lectures", dest: "Schedule" },
  { key: "academic", name: "Academic dates", dest: "Schedule, all-day" },
  { key: "other", name: "Other course events", dest: "Tasks" },
];

const capitalizeWords = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Short stable hash so re-importing the same event overwrites its block
// instead of adding a second one.
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const plusHours = (time: string, hours: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// "סתיו תשפ"ז (א2027)" -> "סתיו תשפ"ז"
const seasonOf = (description: string) => description.replace(/\s*\([^)]*\)\s*$/, "").trim();

const toBlock = (e: IcsEvent): TimeBlock => {
  if (groupOf(e) === "academic") {
    const season = seasonOf(e.description);
    return {
      id: `imp_${e.startDate}_ac_${hash(e.summary + e.description)}`,
      date: e.startDate,
      startTime: "07:00",
      endTime: "23:00",
      title: season ? `${e.summary} · ${season}` : e.summary || "Academic date",
    };
  }
  const course = capitalizeWords((e.course ?? "").trim());
  const start = e.startTime ?? "07:00";
  return {
    id: `imp_${e.startDate}_${start.replace(":", "")}_${hash(`${e.courseNumber ?? course}|${e.summary}`)}`,
    date: e.startDate,
    startTime: start,
    endTime: e.endTime ?? (e.startTime ? plusHours(start, 2) : "23:00"),
    title: course ? `${e.summary || "מפגש"} · ${course}` : e.summary || "מפגש",
    ...(course && e.year && e.semester ? { courseId: `${e.year}|${e.semester}|${course}` } : {}),
    ...(e.location ? { notes: e.location } : {}),
  };
};

interface Result {
  tasks: number;
  blocks: number;
  skipped: number;
  unparseable: number;
  failed: number;
  reasons: string[];
}

const ImportCalendarModal: React.FC<Props> = ({ isOpen, onClose, events, onDone }) => {
  const { addHomework, getCourseTasks } = useHomework();
  const { blocks: existingBlocks, saveBlock } = useTimeBlocks();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<Group, boolean>>({
    maman: true,
    mamach: true,
    meeting: true,
    academic: true,
    other: false,
  });
  const [autoCreate, setAutoCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);

  const counts = useMemo(() => {
    const c: Record<Group, number> = { maman: 0, mamach: 0, meeting: 0, academic: 0, other: 0 };
    events.forEach((e) => (c[groupOf(e)] += 1));
    return c;
  }, [events]);

  const toImport = useMemo(() => events.filter((e) => selected[groupOf(e)]), [events, selected]);

  // What the current choice will add, for the live summary: tasks and
  // lectures per course, plus academic dates.
  const preview = useMemo(() => {
    const byCourse = new Map<
      string,
      { key: string; name: string; semester: string; year: number; tasks: number; lectures: number }
    >();
    let unlinked = 0;
    let dates = 0;
    for (const e of toImport) {
      const g = groupOf(e);
      if (g === "academic") {
        dates++;
        continue;
      }
      if (!e.year || !e.semester || !e.course) {
        unlinked++;
        continue;
      }
      const name = capitalizeWords(e.course.trim());
      const key = `${e.year}|${e.semester}|${name}`;
      const c = byCourse.get(key) ?? { key, name, semester: e.semester, year: e.year, tasks: 0, lectures: 0 };
      if (g === "meeting") c.lectures++;
      else c.tasks++;
      byCourse.set(key, c);
    }
    const courses = [...byCourse.values()].sort((a, b) => b.tasks + b.lectures - (a.tasks + a.lectures));
    const tasks = courses.reduce((n, c) => n + c.tasks, 0);
    const lectures = courses.reduce((n, c) => n + c.lectures, 0);
    const mixedTerms = new Set(courses.map((c) => `${c.semester}|${c.year}`)).size > 1;
    return { courses, tasks, lectures, dates, unlinked, mixedTerms, total: tasks + lectures + dates };
  }, [toImport]);

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const reasons: string[] = [];
    let tasks = 0;
    let blocks = 0;
    let skipped = 0;
    let unparseable = 0;
    let failed = 0;

    // Group course-linked events by (year, semester, course).
    const groups = new Map<string, { year: number; semester: string; course: string; events: IcsEvent[] }>();
    const academic: IcsEvent[] = [];
    for (const e of toImport) {
      if (groupOf(e) === "academic") {
        academic.push(e);
        continue;
      }
      if (!e.year || !e.semester || !e.course) {
        unparseable++;
        continue;
      }
      const course = capitalizeWords(e.course.trim());
      const key = `${e.year}|${e.semester}|${course}`;
      if (!groups.has(key)) groups.set(key, { year: e.year, semester: e.semester, course, events: [] });
      groups.get(key)!.events.push(e);
    }

    const blockIds = new Set(existingBlocks.map((b) => b.id));
    const addBlock = async (e: IcsEvent) => {
      const block = toBlock(e);
      if (blockIds.has(block.id)) {
        skipped++;
        return;
      }
      await saveBlock(block);
      blockIds.add(block.id);
      blocks++;
    };

    for (const [, g] of groups) {
      setProgress(`${g.course} (${g.semester} ${g.year})…`);
      // Names become Firestore path segments; skip the group rather than
      // write under a re-rooted path.
      if (!isSafeSegment(g.course) || !isSafeSegment(g.semester)) {
        failed += g.events.length;
        reasons.push(`${g.course}: invalid course name`);
        continue;
      }
      // A course with only lectures is still a course: create it too.
      if (autoCreate) {
        await initializeYear(g.year);
        await addCourse(g.year, g.semester, g.course);
      }

      for (const e of g.events.filter((x) => groupOf(x) === "meeting")) await addBlock(e);

      const taskEvents = g.events.filter((x) => TASK_GROUPS.includes(groupOf(x)));
      if (!taskEvents.length) continue;
      let existing: { name: string; dueDate: string }[] = [];
      try {
        existing = await getCourseTasks(g.year, g.semester, g.course, true);
      } catch {
        /* ignore */
      }
      const seen = new Set(existing.map((t) => `${t.name}|${t.dueDate}`));
      for (const e of taskEvents) {
        const name = buildTaskName(e);
        const dueDate = e.startDate;
        const key = `${name}|${dueDate}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        // Deterministic doc ID so re-imports overwrite instead of duplicate.
        const stableId = `${IMPORTED_TASK_PREFIX}${dueDate}_${name}`.replace(/[\\/]/g, "_").slice(0, 500);
        try {
          await addHomework(stableId, name, dueDate, "PENDING", g.year, g.semester, g.course);
          seen.add(key);
          tasks++;
        } catch (err) {
          failed++;
          reasons.push(`${g.course} – ${name}: ${(err as Error).message}`);
        }
      }
    }

    if (academic.length) setProgress("Academic dates…");
    for (const e of academic) await addBlock(e);

    setProgress("");
    setResult({ tasks, blocks, skipped, unparseable, failed, reasons });
    setBusy(false);
    const added = tasks + blocks;
    if (added > 0) {
      toast.success(
        [tasks && plural(tasks, "task", "tasks"), blocks && plural(blocks, "Schedule block", "Schedule blocks")]
          .filter(Boolean)
          .join(" and ") + " added"
      );
    } else if (failed > 0) {
      toast.error("Import failed — nothing added");
    } else {
      toast.info("Nothing new to import");
    }
    onDone();
  };

  const close = () => {
    if (busy) return;
    setResult(null);
    setProgress("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Import calendar"
      footer={
        result ? (
          <button className="app-modal-btn-primary" onClick={close}>
            Done
          </button>
        ) : (
          <>
            <button className="app-modal-btn-cancel" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button className="app-modal-btn-primary" onClick={handleImport} disabled={busy || preview.total === 0}>
              {busy ? (
                <span className="import-btn-busy">
                  <span className="import-spinner" />
                  Importing…
                </span>
              ) : preview.total === 0 ? (
                "Nothing to import"
              ) : (
                `Import ${plural(preview.total, "item", "items")}`
              )}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="import-result">
          <span
            className={`import-result-mark${result.tasks + result.blocks ? "" : " import-result-mark-muted"}`}
            aria-hidden="true"
          >
            {result.tasks + result.blocks ? <Check size={26} strokeWidth={2.6} /> : <Info size={24} strokeWidth={2.2} />}
          </span>
          <p className="import-result-title">
            {result.tasks + result.blocks
              ? "Your calendar is in"
              : result.failed
                ? "Nothing was imported"
                : "Already up to date"}
          </p>
          <ul className="import-result-list">
            {result.tasks > 0 && (
              <li>
                <b>{result.tasks}</b> {result.tasks === 1 ? "task" : "tasks"} added
              </li>
            )}
            {result.blocks > 0 && (
              <li>
                <b>{result.blocks}</b> added to your Schedule
              </li>
            )}
            {result.skipped > 0 && (
              <li>
                <b>{result.skipped}</b> already in your planner
              </li>
            )}
            {result.unparseable > 0 && (
              <li>
                <b>{result.unparseable}</b> not linked to a course
              </li>
            )}
            {result.failed > 0 && (
              <li className="import-result-failed">
                <b>{result.failed}</b> couldn't be added
              </li>
            )}
          </ul>
          {result.reasons.length > 0 && (
            <ul className="import-reasons">
              {result.reasons.slice(0, 6).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              {result.reasons.length > 6 && <li>…and {result.reasons.length - 6} more</li>}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* What will happen, live, for the current choice. */}
          <div className="import-hero">
            <p className="import-hero-num">
              {preview.total}
              <span> {preview.total === 1 ? "item" : "items"}</span>
            </p>
            <p className="import-hero-sub">
              {[
                preview.tasks && plural(preview.tasks, "task", "tasks"),
                preview.lectures && plural(preview.lectures, "lecture", "lectures"),
                preview.dates && plural(preview.dates, "academic date", "academic dates"),
              ]
                .filter(Boolean)
                .join(" · ") || `from ${plural(events.length, "event", "events")} in your file`}
            </p>
          </div>

          {preview.courses.length > 0 && (
            <>
              <p className="import-section">Courses</p>
              <ul className="import-group import-courses">
                {preview.courses.map((c) => (
                  <li key={c.key} className="import-item" dir={/[֐-׿]/.test(c.name) ? "rtl" : "ltr"}>
                    <span className="import-item-label import-course-name">{c.name}</span>
                    {/* One quiet line: what this course gets, and its term only
                        when the file spans more than one. */}
                    <span className="import-course-detail" dir="ltr" title={`${c.semester} ${c.year}`}>
                      {[
                        preview.mixedTerms && `${c.semester.replace("Semester ", "")} ${c.year}`,
                        c.tasks > 0 && plural(c.tasks, "task", "tasks"),
                        c.lectures > 0 && plural(c.lectures, "lecture", "lectures"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {preview.unlinked > 0 && (
            <p className="import-note">
              {preview.unlinked} selected {preview.unlinked === 1 ? "event isn't" : "events aren't"} linked to a course
              and will be skipped.
            </p>
          )}

          <p className="import-section">Include</p>
          <div className="import-group">
            {GROUPS.filter((g) => counts[g.key] > 0).map((g) => (
              <label key={g.key} className="import-item">
                <span className="import-item-text">
                  <span className="import-item-label">{g.name}</span>
                  <span className="import-item-sub">
                    {counts[g.key]} → {g.dest}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="import-switch"
                  checked={selected[g.key]}
                  disabled={busy}
                  onChange={(e) => setSelected((s) => ({ ...s, [g.key]: e.target.checked }))}
                />
              </label>
            ))}
            <label className="import-item">
              <span className="import-item-text">
                <span className="import-item-label">Create missing courses</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="import-switch"
                checked={autoCreate}
                disabled={busy}
                onChange={(e) => setAutoCreate(e.target.checked)}
              />
            </label>
          </div>
          {progress && <div className="import-progress">{progress}</div>}
        </>
      )}
    </Modal>
  );
};

export default ImportCalendarModal;
