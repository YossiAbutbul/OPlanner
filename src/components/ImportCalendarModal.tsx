import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { IcsEvent, IcsCategory, buildTaskName } from "../utility/parseIcs";
import { useHomework } from "../context/HomeworkContext";
import { useToast } from "../context/ToastContext";
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
  const toast = useToast();
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
    unparseable: number;
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
    if (busy) return;
    setBusy(true);
    setResult(null);
    const reasons: string[] = [];
    let added = 0;
    let skipped = 0;
    let unparseable = 0;
    let failed = 0;

    // Group events by (year, semester, course) to dedupe lookups
    const groups = new Map<string, { year: number; semester: string; course: string; events: IcsEvent[] }>();
    for (const e of toImport) {
      if (!e.year || !e.semester || !e.course) {
        unparseable++;
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
        // Deterministic doc ID so re-imports overwrite instead of duplicate.
        const stableId = `imp_${dueDate}_${name}`.replace(/[\\/]/g, "_").slice(0, 500);
        try {
          await addHomework(stableId, name, dueDate, "PENDING", g.year, g.semester, g.course);
          seen.add(key);
          added++;
        } catch (err) {
          failed++;
          reasons.push(`${g.course} – ${name}: ${(err as Error).message}`);
        }
      }
    }

    setProgress("");
    setResult({ added, skipped, unparseable, failed, reasons });
    setBusy(false);
    if (added > 0) {
      toast.success(`Imported ${added} ${added === 1 ? "task" : "tasks"}`);
    } else if (failed > 0) {
      toast.error("Import failed — no tasks added");
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
            <button
              className="app-modal-btn-primary"
              onClick={handleImport}
              disabled={busy || toImport.length === 0}
            >
              {busy ? (
                <span className="import-btn-busy">
                  <span className="import-spinner" />
                  Importing…
                </span>
              ) : (
                `Import (${toImport.length})`
              )}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="import-result">
          <ul className="import-result-list">
            <li className="import-stat import-stat-added">
              <span className="import-stat-num">{result.added}</span>
              <span className="import-stat-label">Added</span>
            </li>
            <li className="import-stat import-stat-skipped">
              <span className="import-stat-num">{result.skipped}</span>
              <span className="import-stat-label">Already in DB</span>
            </li>
            <li className="import-stat import-stat-unparseable">
              <span className="import-stat-num">{result.unparseable}</span>
              <span className="import-stat-label">Non-course events</span>
            </li>
            <li className="import-stat import-stat-failed">
              <span className="import-stat-num">{result.failed}</span>
              <span className="import-stat-label">Failed</span>
            </li>
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
