import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ExternalLink, FilePlus2, Lightbulb, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import DeleteModal from "./DeleteModal";
import ExamSetupModal from "./ExamSetupModal";
import ExamRowModal from "./ExamRowModal";
import { useCourseMeta } from "../hooks/useCourseMeta";
import { useToast } from "../context/ToastContext";
import { MAX_EXAM_COLUMNS, MAX_EXAM_ROWS, MAX_EXAM_LABEL_LEN } from "../services/courseMeta";
import type { CourseTab, ExamColumn, ExamRow, ExamTable } from "../types/models";
import "../css/ExamsPanel.css";

interface Props {
  activeTab: CourseTab;
}

// Column widths (px). The question columns hold a usable minimum so a wide
// table overflows into a horizontal scroll instead of squeezing to nothing.
const NAME_COL_W = 180;
const DONE_COL_W = 56;
const Q_COL_MIN = 80;

// Empty placeholder before the user runs setup — nothing is rendered/persisted
// until they create the grid via the setup modal.
const emptyTable = (): ExamTable => ({ columns: [], rows: [] });

// Touch devices: auto-opening the new row's name input pops the keyboard and
// scrolls unexpectedly. Let the user tap the cell they want instead.
const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

// Append " (2)", " (3)"… until the label is free. Keeps exam rows uniquely named.
const uniqueLabel = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
};

// A label cell that toggles between a static text button and an inline input.
// Click (or focus) to edit; Enter/blur commits, Escape reverts.
const EditableLabel: React.FC<{
  value: string;
  placeholder: string;
  className?: string;
  autoEdit?: boolean;
  // Touch: instead of an inline input, hand off to a bottom-sheet editor.
  onTouchEdit?: () => void;
  onCommit: (next: string) => void;
}> = ({ value, placeholder, className, autoEdit = false, onTouchEdit, onCommit }) => {
  // autoEdit starts the cell in edit mode on mount (e.g. a freshly added row).
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  const start = () => {
    if (onTouchEdit && isCoarsePointer()) { onTouchEdit(); return; }
    setEditing(true);
  };

  if (editing) {
    return (
      <input
        className={`ep-label-input ${className ?? ""}`}
        type="text"
        autoFocus
        // size=1 + width:100% keeps the input from inflating the column width
        // on edit; it just fills the fixed cell.
        size={1}
        maxLength={MAX_EXAM_LABEL_LEN}
        value={draft}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={`ep-label-text ${className ?? ""} ${value ? "" : "ep-label-empty"}`}
      title="Click to rename"
      onClick={start}
    >
      {value || placeholder}
    </button>
  );
};

// Bottom-sheet rename editor for touch devices. Slides up from the bottom;
// tap the backdrop or Cancel to dismiss, Save commits the trimmed value.
const RenameSheet: React.FC<{
  title: string;
  initialValue: string;
  onSave: (next: string) => void;
  onClose: () => void;
}> = ({ title, initialValue, onSave, onClose }) => {
  const [draft, setDraft] = useState(initialValue);

  const save = () => {
    const next = draft.trim();
    if (next) onSave(next);
    onClose();
  };

  return createPortal(
    <div className="ep-sheet-backdrop" onClick={onClose}>
      <div className="ep-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h4 className="ep-sheet-title">{title}</h4>
        <input
          className="ep-sheet-input"
          type="text"
          autoFocus
          maxLength={MAX_EXAM_LABEL_LEN}
          value={draft}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        />
        <div className="ep-sheet-actions">
          <button type="button" className="ep-sheet-btn ep-sheet-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="ep-sheet-btn ep-sheet-save" onClick={save}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Exams tab: a checkbox grid of exam papers (rows) × questions (columns).
// Both axes' labels rename inline. Rows and columns add/delete freely. The
// whole table is persisted optimistically on every edit, like course links.
const ExamsPanel: React.FC<Props> = ({ activeTab }) => {
  const { meta, loading, save } = useCourseMeta(activeTab);
  const toast = useToast();

  const [table, setTable] = useState<ExamTable>(emptyTable);
  const [setupOpen, setSetupOpen] = useState(false);
  // Exam being edited (name + link) in the row modal. null = closed.
  const [editRow, setEditRow] = useState<ExamRow | null>(null);
  // Touch rename target (bottom sheet). null = closed.
  const [sheet, setSheet] = useState<{ title: string; value: string; onSave: (v: string) => void } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "row"; id: string; label: string }
    | { kind: "column"; id: string; label: string }
    | null
  >(null);

  // Re-sync from the hook. With remote data, mirror it (unless unchanged). With
  // none, show the starter default so a fresh course isn't an empty grid.
  const lastRemoteRef = useRef<string>("");
  useEffect(() => {
    const remote = meta.examTable;
    if (remote) {
      const key = JSON.stringify(remote);
      if (key !== lastRemoteRef.current) {
        lastRemoteRef.current = key;
        setTable(remote);
      }
    } else {
      lastRemoteRef.current = "";
      setTable(emptyTable());
    }
  }, [meta.examTable]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  const commit = (next: ExamTable) => {
    lastRemoteRef.current = JSON.stringify(next);
    setTable(next);
    saveRef.current({ examTable: next }).catch((e) => {
      console.error("Error saving exam table:", e);
      toast.error("Couldn't save exams. Try again.");
    });
  };

  // No columns and no rows → show the setup call-to-action instead of an empty
  // grid. Covers a fresh course and a table the user fully cleared out.
  const needsSetup = table.columns.length === 0 && table.rows.length === 0;
  const atColumnLimit = table.columns.length >= MAX_EXAM_COLUMNS;
  const atRowLimit = table.rows.length >= MAX_EXAM_ROWS;

  // Build the initial grid from the setup modal: N exams × M questions.
  const createTable = (questions: number, exams: number) => {
    const columns: ExamColumn[] = Array.from({ length: questions }, (_, i) => ({
      id: crypto.randomUUID(),
      label: `Q${i + 1}`,
    }));
    const rows: ExamRow[] = Array.from({ length: exams }, (_, i) => ({
      id: crypto.randomUUID(),
      label: `Exam ${i + 1}`,
      checks: {},
    }));
    commit({ columns, rows });
    setSetupOpen(false);
  };

  const addColumn = () => {
    if (atColumnLimit) return;
    const col: ExamColumn = { id: crypto.randomUUID(), label: `Q${table.columns.length + 1}` };
    commit({ ...table, columns: [...table.columns, col] });
  };

  const addRow = () => {
    if (atRowLimit) return;
    const taken = new Set(table.rows.map((r) => r.label));
    const row: ExamRow = { id: crypto.randomUUID(), label: uniqueLabel("New exam", taken), checks: {} };
    // Every exam needs at least one question — seed Q1 if the table has no
    // columns yet.
    const columns = table.columns.length
      ? table.columns
      : [{ id: crypto.randomUUID(), label: "Q1" }];
    commit({ ...table, columns, rows: [...table.rows, row] });
    // Open the edit modal on the fresh row so the user names it (and can add a
    // link) right away.
    setEditRow(row);
  };

  const renameColumn = (id: string, label: string) =>
    commit({ ...table, columns: table.columns.map((c) => (c.id === id ? { ...c, label } : c)) });

  // Save name + links from the row modal. Name is uniquified against siblings.
  // Empty url keys are omitted entirely — Firestore rejects `undefined`.
  const saveRow = (id: string, label: string, url: string, solutionUrl: string) => {
    const taken = new Set(table.rows.filter((r) => r.id !== id).map((r) => r.label));
    const unique = uniqueLabel(label, taken);
    commit({
      ...table,
      rows: table.rows.map((r) => {
        if (r.id !== id) return r;
        const next: ExamRow = { id: r.id, label: unique, checks: r.checks };
        if (url) next.url = url;
        if (solutionUrl) next.solutionUrl = solutionUrl;
        return next;
      }),
    });
    setEditRow(null);
  };

  const removeColumn = (id: string) =>
    commit({
      ...table,
      columns: table.columns.filter((c) => c.id !== id),
      // Drop the orphaned checks so deleted columns leave no stale data.
      rows: table.rows.map((r) => {
        const checks = { ...r.checks };
        delete checks[id];
        return { ...r, checks };
      }),
    });

  const removeRow = (id: string) =>
    commit({ ...table, rows: table.rows.filter((r) => r.id !== id) });

  const toggleCheck = (rowId: string, colId: string) =>
    commit({
      ...table,
      rows: table.rows.map((r) => {
        if (r.id !== rowId) return r;
        const checks = { ...r.checks };
        if (checks[colId]) delete checks[colId];
        else checks[colId] = true;
        return { ...r, checks };
      }),
    });

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "row") removeRow(pendingDelete.id);
    else removeColumn(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="ep">
      <section className="ep-section">
        <div className="ep-section-head">
          <h3>Exams</h3>
          {!needsSetup && (
            <div className="ep-head-actions">
              <button
                type="button"
                className="ep-add-q-btn"
                onClick={addColumn}
                disabled={atColumnLimit}
                title={atColumnLimit ? `Limit of ${MAX_EXAM_COLUMNS} questions` : "Add question column"}
              >
                <Plus size={15} />
                Add question
              </button>
              <button
                type="button"
                className="ep-add-exam-btn"
                onClick={addRow}
                disabled={atRowLimit}
                title={atRowLimit ? `Limit of ${MAX_EXAM_ROWS} exams` : "Add exam"}
              >
                <FilePlus2 size={15} />
                Add exam
              </button>
            </div>
          )}
        </div>

        {needsSetup ? (
          loading ? null : (
            <div className="ep-setup">
              <div className="ep-setup-icon" aria-hidden="true">
                <ListChecks size={30} strokeWidth={1.7} />
              </div>
              <h2 className="ep-setup-title">Set up your exam tracker</h2>
              <p className="ep-setup-text">
                Tell us how many questions each exam has and we'll build the grid.
                You can adjust the rows and columns anytime.
              </p>
              <button type="button" className="ep-add-exam-btn ep-setup-btn" onClick={() => setSetupOpen(true)}>
                <ListChecks size={16} />
                Set up table
              </button>
            </div>
          )
        ) : (
          <div className="ep-grid">
            <div className="ep-table-scroll">
            <table
              className="ep-table"
              style={{ minWidth: NAME_COL_W + DONE_COL_W + table.columns.length * Q_COL_MIN }}
            >
              <thead>
                <tr>
                  <th className="ep-corner">Exam</th>
                  <th className="ep-progress-head">Done</th>
                  {table.columns.map((c) => (
                    <th key={c.id} className="ep-col-head">
                      <div className="ep-col-head-inner">
                        <EditableLabel
                          value={c.label}
                          placeholder="Q?"
                          className="ep-col-label"
                          onTouchEdit={() => setSheet({ title: "Rename question", value: c.label, onSave: (v) => renameColumn(c.id, v) })}
                          onCommit={(label) => renameColumn(c.id, label)}
                        />
                      </div>
                      <button
                        type="button"
                        className="ep-icon-btn ep-icon-delete ep-col-del"
                        onClick={() => setPendingDelete({ kind: "column", id: c.id, label: c.label })}
                        aria-label={`Delete question ${c.label}`}
                        title="Delete question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...table.rows]
                  .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
                  .map((r) => {
                  const total = table.columns.length;
                  const doneCount = table.columns.filter((c) => r.checks[c.id]).length;
                  const complete = total > 0 && doneCount === total;
                  return (
                  <tr key={r.id} className={complete ? "ep-row-complete" : ""}>
                    <th scope="row" className="ep-row-head">
                      <div className="ep-row-head-inner">
                        <button
                          type="button"
                          className="ep-row-name"
                          title="Edit exam"
                          onClick={() => setEditRow(r)}
                        >
                          {r.label}
                        </button>
                        {r.url && (
                          <a
                            className="ep-row-link"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open exam link for ${r.label}`}
                            title="Open exam link"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {r.solutionUrl && (
                          <a
                            className="ep-row-link ep-row-link-solution"
                            href={r.solutionUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open solution link for ${r.label}`}
                            title="Open solution link"
                          >
                            <Lightbulb size={13} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="ep-icon-btn ep-row-edit"
                          onClick={() => setEditRow(r)}
                          aria-label={`Edit exam ${r.label}`}
                          title="Edit exam"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="ep-icon-btn ep-icon-delete"
                          onClick={() => setPendingDelete({ kind: "row", id: r.id, label: r.label })}
                          aria-label={`Delete exam ${r.label}`}
                          title="Delete exam"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </th>
                    <td className="ep-progress-cell">
                      {total > 0 && (
                        <span
                          className={`ep-row-progress ${complete ? "ep-row-progress-done" : ""}`}
                          title={`${doneCount} of ${total} questions done`}
                        >
                          {doneCount}/{total}
                        </span>
                      )}
                    </td>
                    {table.columns.map((c) => {
                      const done = !!r.checks[c.id];
                      return (
                        <td key={c.id} className="ep-cell">
                          <button
                            type="button"
                            className={`ep-check ${done ? "ep-check-done" : ""}`}
                            onClick={() => toggleCheck(r.id, c.id)}
                            role="checkbox"
                            aria-checked={done}
                            aria-label={`${r.label} — ${c.label}`}
                          >
                            {done && <Check size={11} strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      <ExamSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        onCreate={createTable}
      />

      <ExamRowModal
        isOpen={editRow !== null}
        initialName={editRow?.label ?? ""}
        initialUrl={editRow?.url ?? ""}
        initialSolutionUrl={editRow?.solutionUrl ?? ""}
        onSave={(name, url, solutionUrl) => editRow && saveRow(editRow.id, name, url, solutionUrl)}
        onClose={() => setEditRow(null)}
      />

      <DeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete?.kind === "column" ? "Delete question" : "Delete exam"}
        message={
          pendingDelete?.kind === "column"
            ? `Delete question “${pendingDelete?.label || "this column"}” and its checks across all exams? This can't be undone.`
            : `Delete exam “${pendingDelete?.label || "this row"}”? This can't be undone.`
        }
      />

      {sheet && (
        <RenameSheet
          title={sheet.title}
          initialValue={sheet.value}
          onSave={sheet.onSave}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
};

export default ExamsPanel;
