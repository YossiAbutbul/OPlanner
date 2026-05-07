import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { IcsEvent, IcsCategory, buildTaskName } from "../utility/parseIcs";
import { useHomework } from "../context/HomeworkContext";
import {
  initializeYear,
  addCourse,
} from "../utility/initializeDatabase";
import "../css/ImportCalendarModal.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: IcsEvent[];
  onDone: () => void;
}

const CATEGORY_LABEL: Record<IcsCategory, string> = {
  meeting: "Meetings",
  maman: "Assignments (MAMANS)",
  mamach: "Computer Assignments (MAMAHS)",
  other: "Other",
};

const capitalizeWords = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const ImportCalendarModal: React.FC<Props> = ({ isOpen, onClose, events, onDone }) => {
  const { addHomework, getCourseTasks } = useHomework();
  const [selected, setSelected] = useState<Record<IcsCategory, boolean>>({
    meeting: false,
    maman: true,
    mamach: true,
    other: false,
  });
  const [autoCreate, setAutoCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
    failed: number;
    reasons: string[];
  } | null>(null);

  const counts = useMemo(() => {
    const c: Record<IcsCategory, number> = { meeting: 0, maman: 0, mamach: 0, other: 0 };
    events.forEach((e) => (c[e.category] += 1));
    return c;
  }, [events]);

  const toImport = useMemo(
    () => events.filter((e) => selected[e.category]),
    [events, selected]
  );

  const handleImport = async () => {
    setBusy(true);
    setResult(null);
    const reasons: string[] = [];
    let added = 0;
    let skipped = 0;
    let failed = 0;

    // Group events by (year, semester, course) to dedupe lookups
    const groups = new Map<string, { year: number; semester: string; course: string; events: IcsEvent[] }>();
    for (const e of toImport) {
      if (!e.year || !e.semester || !e.course) {
        failed++;
        reasons.push(`Could not parse course/semester for: ${e.summary}`);
        continue;
      }
      const course = capitalizeWords(e.course.trim());
      const key = `${e.year}|${e.semester}|${course}`;
      if (!groups.has(key))
        groups.set(key, { year: e.year, semester: e.semester, course, events: [] });
      groups.get(key)!.events.push(e);
    }

    for (const [, g] of groups) {
      setProgress(`${g.course} (${g.semester} ${g.year})…`);
      if (autoCreate) {
        await initializeYear(g.year);
        await addCourse(g.year, g.semester, g.course);
      }
      let existing: { name: string; dueDate: string }[] = [];
      try {
        existing = await getCourseTasks(g.year, g.semester, g.course, true);
      } catch {
        /* ignore */
      }
      const seen = new Set(existing.map((t) => `${t.name}|${t.dueDate}`));
      for (const e of g.events) {
        const name = buildTaskName(e);
        const dueDate = e.startDate;
        const key = `${name}|${dueDate}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        try {
          await addHomework(null, name, dueDate, "PENDING", g.year, g.semester, g.course);
          seen.add(key);
          added++;
        } catch (err) {
          failed++;
          reasons.push(`${g.course} – ${name}: ${(err as Error).message}`);
        }
      }
    }

    setProgress("");
    setResult({ added, skipped, failed, reasons });
    setBusy(false);
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
            <button
              className="app-modal-btn-primary"
              onClick={handleImport}
              disabled={busy || toImport.length === 0}
            >
              {busy ? "Importing…" : `Import (${toImport.length})`}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="import-result">
          <p>
            Added <strong>{result.added}</strong>, skipped{" "}
            <strong>{result.skipped}</strong> duplicates,{" "}
            <strong>{result.failed}</strong> failed.
          </p>
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
          <p className="import-hint">
            Found <strong>{events.length}</strong> events. Choose which to import as tasks.
          </p>
          <div className="import-categories">
            {(Object.keys(CATEGORY_LABEL) as IcsCategory[]).map((cat) => (
              <label key={cat} className="import-cat">
                <input
                  type="checkbox"
                  checked={selected[cat]}
                  disabled={counts[cat] === 0 || busy}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [cat]: e.target.checked }))
                  }
                />
                <span className="import-cat-label">{CATEGORY_LABEL[cat]}</span>
                <span className="import-cat-count">{counts[cat]}</span>
              </label>
            ))}
          </div>
          <label className="import-toggle">
            <input
              type="checkbox"
              checked={autoCreate}
              disabled={busy}
              onChange={(e) => setAutoCreate(e.target.checked)}
            />
            <span>Auto-create missing year / course</span>
          </label>
          {progress && <div className="import-progress">{progress}</div>}
        </>
      )}
    </Modal>
  );
};

export default ImportCalendarModal;
