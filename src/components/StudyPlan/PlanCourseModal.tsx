import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "../Modal";
import CustomSelect from "../CustomSelect";
import { STATUSES, STATUS_LABEL, MAX_COMPONENTS, MAX_CREDITS } from "../../services/plan";
import { componentEstimate } from "../../hooks/usePlanStats";
import { formatGrade } from "../../utility/planFormat";
import type {
  GradeComponent,
  PlanConfig,
  PlanCourse,
  PlanCourseStatus,
} from "../../types/models";

interface Props {
  isOpen: boolean;
  course: PlanCourse | null; // null = add
  config: PlanConfig;
  onClose: () => void;
  onSave: (course: PlanCourse) => Promise<void>;
}

const SEMESTERS = ["Semester A", "Semester B", "Semester C"];

const emptyCourse = (): PlanCourse => ({
  id: crypto.randomUUID(),
  name: "",
  credits: 0,
  status: "PLANNED",
  source: "manual",
  updatedAt: Date.now(),
});

// Numbers come out of inputs as strings; keep them as strings in state so a
// half-typed "3." doesn't get clobbered mid-edit.
const numOrUndef = (v: string): number | undefined => {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const PlanCourseModal: React.FC<Props> = ({ isOpen, course, config, onClose, onSave }) => {
  const [draft, setDraft] = useState<PlanCourse>(emptyCourse);
  const [credits, setCredits] = useState("");
  const [grade, setGrade] = useState("");
  const [year, setYear] = useState("");
  const [cost, setCost] = useState("");
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const base = course ?? emptyCourse();
    setDraft(base);
    setCredits(base.credits ? String(base.credits) : "");
    setGrade(base.grade !== undefined ? String(base.grade) : "");
    setYear(base.year !== undefined ? String(base.year) : "");
    setCost(base.costOverride !== undefined ? String(base.costOverride) : "");
    setComponents(base.components ?? []);
    setError(null);
    setSaving(false);
  }, [isOpen, course]);

  const groupOptions = useMemo(
    () => [
      { value: "", label: "No group" },
      ...config.groups.map((g) => ({ value: g.id, label: g.label })),
    ],
    [config.groups]
  );

  const estimate = useMemo(
    () => componentEstimate({ ...draft, components }),
    [draft, components]
  );
  const weightSum = components.reduce((s, c) => s + (c.weight || 0), 0);

  const updateComponent = (id: string, patch: Partial<GradeComponent>) =>
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError("Give the course a name.");
      return;
    }
    const creditsNum = numOrUndef(credits) ?? 0;
    if (creditsNum < 0 || creditsNum > MAX_CREDITS) {
      setError(`Credits must be between 0 and ${MAX_CREDITS}.`);
      return;
    }
    const gradeNum = numOrUndef(grade);
    if (gradeNum !== undefined && (gradeNum < 0 || gradeNum > 100)) {
      setError("Grade must be between 0 and 100.");
      return;
    }

    const cleaned: PlanCourse = {
      ...draft,
      name,
      code: draft.code?.trim() || undefined,
      credits: creditsNum,
      grade: gradeNum,
      year: numOrUndef(year),
      costOverride: numOrUndef(cost),
      components: components
        .filter((c) => c.label.trim())
        .map((c) => ({ ...c, label: c.label.trim() })),
      updatedAt: Date.now(),
    };
    if (cleaned.components && cleaned.components.length === 0) delete cleaned.components;

    try {
      setSaving(true);
      await onSave(cleaned);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={course ? "Edit course" : "Add course"}
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="app-modal-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : course ? "Save course" : "Add course"}
          </button>
        </>
      }
    >
      <div className="sp-form">
        <div className="sp-field">
          <label htmlFor="sp-course-name">Course name</label>
          <input
            id="sp-course-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Operating Systems"
          />
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label htmlFor="sp-course-code">Code</label>
            <input
              id="sp-course-code"
              type="text"
              value={draft.code ?? ""}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              placeholder="62350"
            />
          </div>
          <div className="sp-field">
            <label htmlFor="sp-course-credits">Credits</label>
            <input
              id="sp-course-credits"
              type="number"
              min={0}
              max={MAX_CREDITS}
              step={0.5}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="4"
            />
          </div>
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label htmlFor="sp-course-year">Year</label>
            <input
              id="sp-course-year"
              type="number"
              min={1900}
              max={2200}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
            />
          </div>
          <div className="sp-field">
            <label id="sp-course-sem-label">Semester</label>
            <CustomSelect
              value={draft.semester ?? ""}
              options={[
                { value: "", label: "No semester" },
                ...SEMESTERS.map((s) => ({ value: s, label: s })),
              ]}
              onChange={(v) => setDraft({ ...draft, semester: v || undefined })}
            />
          </div>
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label>Status</label>
            <CustomSelect
              value={draft.status}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              onChange={(v) => setDraft({ ...draft, status: v as PlanCourseStatus })}
            />
          </div>
          <div className="sp-field">
            <label>Group</label>
            <CustomSelect
              value={draft.groupId ?? ""}
              options={groupOptions}
              onChange={(v) => setDraft({ ...draft, groupId: v || undefined })}
            />
          </div>
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label htmlFor="sp-course-grade">Final grade</label>
            <input
              id="sp-course-grade"
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder={estimate !== null ? `${formatGrade(estimate)} from parts` : "86"}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="sp-course-cost">Cost override</label>
            <input
              id="sp-course-cost"
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="from price per credit"
            />
          </div>
        </div>

        <div className="sp-checks">
          <label>
            <input
              type="checkbox"
              checked={draft.passFail === true}
              onChange={(e) => setDraft({ ...draft, passFail: e.target.checked || undefined })}
            />
            Pass / fail (credits count, grade stays out of the average)
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.countsToward === false}
              onChange={(e) => setDraft({ ...draft, countsToward: e.target.checked ? false : undefined })}
            />
            Audited (does not count toward the degree)
          </label>
        </div>

        <div className="sp-parts">
          <div className="sp-parts-head">
            <h4>Grade parts</h4>
            <span className="sp-hint">
              {components.length > 0
                ? `weights ${weightSum}%${estimate !== null ? ` · ${formatGrade(estimate)} so far` : ""}`
                : "exam, assignments, lab"}
            </span>
          </div>
          {components.map((c) => (
            <div className="sp-part-row" key={c.id}>
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateComponent(c.id, { label: e.target.value })}
                placeholder="Final exam"
                aria-label="Part name"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight || ""}
                onChange={(e) => updateComponent(c.id, { weight: Number(e.target.value) || 0 })}
                placeholder="60"
                aria-label="Weight percent"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={c.grade ?? ""}
                onChange={(e) =>
                  updateComponent(c.id, { grade: numOrUndef(e.target.value) })
                }
                placeholder="grade"
                aria-label="Part grade"
              />
              <button
                type="button"
                className="sp-danger"
                onClick={() => setComponents((prev) => prev.filter((p) => p.id !== c.id))}
                aria-label={`Remove ${c.label || "part"}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {components.length < MAX_COMPONENTS && (
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              onClick={() =>
                setComponents((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), label: "", weight: 0 },
                ])
              }
            >
              <Plus size={14} />
              Add part
            </button>
          )}
        </div>

        {error && <p className="sp-error">{error}</p>}
      </div>
    </Modal>
  );
};

export default PlanCourseModal;
