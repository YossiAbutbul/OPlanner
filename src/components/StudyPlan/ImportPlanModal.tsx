import React, { useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import Modal from "../Modal";
import CustomSelect from "../CustomSelect";
import {
  MAPPABLE_FIELDS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  applyRow,
  diffRows,
  parseImportText,
  rowKey,
  rowsFromTable,
  type DiffEntry,
  type ParsedImport,
  type PlanField,
} from "../../utility/planImport";
import type { PlanConfig, PlanCourse } from "../../types/models";

interface Props {
  isOpen: boolean;
  config: PlanConfig;
  courses: PlanCourse[];
  onClose: () => void;
  onImport: (
    created: PlanCourse[],
    updated: PlanCourse[],
    before: PlanCourse[],
    meta: { fileName?: string; adapter: string }
  ) => Promise<void>;
}

type Step = "input" | "map";

const ACCEPT = ".csv,.tsv,.txt,.html,.htm,text/csv,text/plain,text/html";

const ImportPlanModal: React.FC<Props> = ({ isOpen, config, courses, onClose, onImport }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("input");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [mapping, setMapping] = useState<PlanField[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("input");
    setPasted("");
    setFileName(undefined);
    setParsed(null);
    setMapping([]);
    setSkipped(new Set());
    setError(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const ingest = (text: string, name?: string) => {
    if (!text.trim()) {
      setError("That file looks empty.");
      return;
    }
    const result = parseImportText(text);
    if (result.table.headers.length === 0 || result.table.rows.length === 0) {
      setError("No table found in there. Export a CSV, or copy the grades table and paste it.");
      return;
    }
    setParsed(result);
    setMapping(result.mapping);
    setFileName(name);
    setError(null);
    setStep("map");
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is over 2MB. Export just the grades table.");
      return;
    }
    ingest(await file.text(), file.name);
  };

  // Rows and their diff recompute on every mapping change, so the preview
  // always matches what the current mapping would write.
  const { entries, groupByLabel } = useMemo(() => {
    const byLabel = new Map(config.groups.map((g) => [g.label.toLowerCase(), g.id]));
    if (!parsed) return { entries: [] as DiffEntry[], groupByLabel: byLabel };
    const rows = rowsFromTable(parsed.table, mapping, config.passMark);
    return { entries: diffRows(rows, courses), groupByLabel: byLabel };
  }, [parsed, mapping, config.groups, config.passMark, courses]);

  const changed = entries.filter((e) => e.kind !== "same");
  const selected = changed.filter((e) => !skipped.has(rowKey(e.row)));
  const newCount = changed.filter((e) => e.kind === "new").length;
  const updCount = changed.filter((e) => e.kind === "update").length;
  const sameCount = entries.length - changed.length;

  const toggleRow = (key: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const commit = async () => {
    if (!parsed || selected.length === 0) return;
    const created: PlanCourse[] = [];
    const updated: PlanCourse[] = [];
    const before: PlanCourse[] = [];

    selected.forEach((entry) => {
      const merged = applyRow(entry.row, entry.existing, "import");
      // Map a text group name onto a configured requirement group when it
      // matches one by label; otherwise leave the course ungrouped.
      const groupText = (entry.row.group ?? "").toLowerCase();
      const groupId = groupByLabel.get(groupText);
      if (groupId) merged.groupId = groupId;

      if (entry.existing) {
        before.push(entry.existing);
        updated.push(merged);
      } else {
        created.push(merged);
      }
    });

    try {
      setBusy(true);
      await onImport(created, updated, before, {
        fileName,
        adapter: parsed.adapter.id,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Import from your university"
      footer={
        step === "input" ? (
          <>
            <button type="button" className="app-modal-btn-cancel" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="app-modal-btn-primary"
              onClick={() => ingest(pasted)}
              disabled={!pasted.trim()}
            >
              Read pasted table
            </button>
          </>
        ) : (
          <>
            <button type="button" className="app-modal-btn-cancel" onClick={reset} disabled={busy}>
              Back
            </button>
            <button
              type="button"
              className="app-modal-btn-primary"
              onClick={commit}
              disabled={busy || selected.length === 0}
            >
              {busy ? "Importing…" : `Import ${selected.length} change${selected.length === 1 ? "" : "s"}`}
            </button>
          </>
        )
      }
    >
      <div className="sp-form">
        {step === "input" ? (
          <>
            <button
              type="button"
              className="sp-drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
            >
              <FileUp size={22} strokeWidth={1.7} />
              <span className="sp-drop-title">Choose a file or drop it here</span>
              <span className="sp-drop-meta">
                CSV, TSV or an HTML grades page, up to 2MB and {MAX_IMPORT_ROWS} rows.
                Parsed on your device, nothing is uploaded.
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />

            <div className="sp-field">
              <label htmlFor="sp-paste">Or paste the table straight from the portal</label>
              <textarea
                id="sp-paste"
                className="sp-paste"
                rows={5}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"Code\tCourse\tCredits\tGrade\n62350\tOperating Systems\t4\t86"}
              />
            </div>
          </>
        ) : (
          <>
            <div className="sp-drop sp-drop-done">
              <Upload size={18} />
              <div>
                <div className="sp-drop-title">{fileName ?? "Pasted table"}</div>
                <div className="sp-drop-meta">
                  {parsed?.table.rows.length ?? 0} rows &middot; read as {parsed?.adapter.label}
                  {parsed?.truncated ? ` · capped at ${MAX_IMPORT_ROWS}` : ""}
                </div>
              </div>
            </div>

            <div className="sp-parts">
              <div className="sp-parts-head">
                <h4>Columns</h4>
                <span className="sp-hint">check what each column means</span>
              </div>
              {parsed?.table.headers.map((header, i) => (
                <div className="sp-map-row" key={`${header}-${i}`}>
                  <span className="sp-map-from" title={header}>
                    {header || `Column ${i + 1}`}
                  </span>
                  <span className="sp-map-arrow">→</span>
                  <CustomSelect
                    value={mapping[i] ?? "ignore"}
                    options={MAPPABLE_FIELDS}
                    onChange={(v) =>
                      setMapping((prev) => prev.map((m, idx) => (idx === i ? (v as PlanField) : m)))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="sp-diff">
              <div className="sp-diff-card sp-diff-new">
                <b>{newCount}</b>
                <span>New</span>
              </div>
              <div className="sp-diff-card sp-diff-upd">
                <b>{updCount}</b>
                <span>Updated</span>
              </div>
              <div className="sp-diff-card">
                <b>{sameCount}</b>
                <span>Unchanged</span>
              </div>
            </div>

            {changed.length === 0 ? (
              <p className="sp-empty-line">
                Nothing to change with this mapping. Check the columns above.
              </p>
            ) : (
              <div className="sp-preview">
                {changed.slice(0, 40).map((entry) => {
                  const key = rowKey(entry.row);
                  const off = skipped.has(key);
                  return (
                    <label className={`sp-prev-row ${off ? "sp-prev-off" : ""}`} key={key}>
                      <input type="checkbox" checked={!off} onChange={() => toggleRow(key)} />
                      <span className="sp-prev-name">{entry.row.name}</span>
                      {entry.kind === "new" ? (
                        <span className="sp-prev-add">
                          new &middot; {entry.row.credits ?? 0} credits
                        </span>
                      ) : (
                        <span className="sp-prev-changes">
                          {entry.changes.slice(0, 2).map((c) => (
                            <span key={c.field}>
                              <i className="sp-prev-old">{c.from}</i>
                              <b>{c.to}</b>
                            </span>
                          ))}
                        </span>
                      )}
                    </label>
                  );
                })}
                {changed.length > 40 && (
                  <p className="sp-hint">{changed.length - 40} more will import too.</p>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="sp-error">{error}</p>}
      </div>
    </Modal>
  );
};

export default ImportPlanModal;
