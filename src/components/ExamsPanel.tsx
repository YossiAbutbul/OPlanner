import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FilePlus2, Plus, Trash2 } from "lucide-react";
import DeleteModal from "./DeleteModal";
import { useCourseMeta } from "../hooks/useCourseMeta";
import { useToast } from "../context/ToastContext";
import { MAX_EXAM_COLUMNS, MAX_EXAM_ROWS, MAX_EXAM_LABEL_LEN } from "../services/courseMeta";
import type { CourseTab, ExamColumn, ExamRow, ExamTable } from "../types/models";
import "../css/ExamsPanel.css";

interface Props {
  activeTab: CourseTab;
}

// Starter table shown for a course with no exam data yet: one exam row and
// two question columns (Q1, Q2). Not persisted until the user interacts.
const buildDefaultTable = (): ExamTable => ({
  columns: [
    { id: crypto.randomUUID(), label: "Q1" },
    { id: crypto.randomUUID(), label: "Q2" },
  ],
  rows: [{ id: crypto.randomUUID(), label: "New exam", checks: {} }],
});

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
  const { meta, save } = useCourseMeta(activeTab);
  const toast = useToast();

  const [table, setTable] = useState<ExamTable>(buildDefaultTable);
  // Row just added — its name cell mounts in edit mode with the text selected.
  const [autoEditRowId, setAutoEditRowId] = useState<string | null>(null);
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
      setTable(buildDefaultTable());
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

  const atColumnLimit = table.columns.length >= MAX_EXAM_COLUMNS;
  const atRowLimit = table.rows.length >= MAX_EXAM_ROWS;

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
    if (!isCoarsePointer()) setAutoEditRowId(row.id);
  };

  const renameColumn = (id: string, label: string) =>
    commit({ ...table, columns: table.columns.map((c) => (c.id === id ? { ...c, label } : c)) });

  const renameRow = (id: string, label: string) => {
    // Disallow duplicate exam names — uniquify against the other rows.
    const taken = new Set(table.rows.filter((r) => r.id !== id).map((r) => r.label));
    const unique = uniqueLabel(label, taken);
    commit({ ...table, rows: table.rows.map((r) => (r.id === id ? { ...r, label: unique } : r)) });
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
          <div className="ep-section-title">
            <h3>Exams</h3>
            <div className="ep-subhead-row">
              <p className="ep-subhead">Track which past exams you've solved.</p>
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
          </div>
        </div>

        {/* "+" on the right border adds a question column. Exam rows are added
            from the "Add exam" button up in the header. */}
        <div className="ep-grid">
          <button
            type="button"
            className="ep-edge-add ep-edge-add-col"
            onClick={addColumn}
            disabled={atColumnLimit}
            aria-label="Add question column"
            title={atColumnLimit ? `Limit of ${MAX_EXAM_COLUMNS} questions` : "Add question"}
          >
            <Plus size={12} />
          </button>

          <div className="ep-table-scroll">
            <table className="ep-table">
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
                        <button
                          type="button"
                          className="ep-icon-btn ep-icon-delete"
                          onClick={() => setPendingDelete({ kind: "column", id: c.id, label: c.label })}
                          aria-label={`Delete question ${c.label}`}
                          title="Delete question"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
                        <EditableLabel
                          value={r.label}
                          placeholder="Exam name"
                          className="ep-row-label"
                          autoEdit={r.id === autoEditRowId}
                          onTouchEdit={() => setSheet({ title: "Rename exam", value: r.label, onSave: (v) => renameRow(r.id, v) })}
                          onCommit={(label) => renameRow(r.id, label)}
                        />
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
      </section>

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
