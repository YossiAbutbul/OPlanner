import React, { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { PlanConfig, PlanCourse } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { effectiveGrade } from "../../hooks/usePlanStats";
import GradesChart from "./GradesChart";
import { formatGrade, termLabel } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
  courses: PlanCourse[];
  onSetGrade: (course: PlanCourse, grade: number | undefined) => Promise<void>;
}

const GradesPanel: React.FC<Props> = ({ stats, config, courses, onSetGrade }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [entryOpen, setEntryOpen] = useState(false);

  const hasChart = stats.byYear.length > 0;
  const target = config.targetAverage;

  const missing = useMemo(
    () =>
      courses
        .filter(
          (c) =>
            (c.status === "COMPLETED" || c.status === "IN_PROGRESS") &&
            !c.passFail &&
            effectiveGrade(c) === null
        )
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    [courses]
  );

  const clearDraft = (id: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });

  const save = async (course: PlanCourse) => {
    const text = (drafts[course.id] ?? "").trim();
    clearDraft(course.id);
    if (!text) return;
    const grade = Number(text);
    if (!Number.isFinite(grade) || grade < 0 || grade > 100) return;
    await onSetGrade(course, grade);
  };

  const showEntry = entryOpen || (!hasChart && missing.length > 0);

  return (
    <section className="sp-block">
      <header className="sp-block-head">
        <h2>Grades</h2>
        {missing.length > 0 && (
          <button type="button" className="sp-link-btn" onClick={() => setEntryOpen((v) => !v)}>
            {entryOpen ? <X size={15} /> : <Plus size={15} />}
            {entryOpen ? "Close" : `Add grades (${missing.length})`}
          </button>
        )}
      </header>

      <div className="sp-grade-top">
        <div className="sp-grade-figure">
          <span className="sp-grade-num">{formatGrade(stats.average)}</span>
          <span className="sp-grade-cap">
            average
            {target !== undefined ? ` · target ${target}` : ""}
          </span>
        </div>

        {hasChart && <GradesChart byYear={stats.byYear} target={target} />}
      </div>

      {stats.projectedAverage !== null &&
        stats.average !== null &&
        Math.abs(stats.projectedAverage - stats.average) >= 0.05 && (
          <p className="sp-block-note">
            Projected {formatGrade(stats.projectedAverage)} once the courses in progress are
            graded.
          </p>
        )}

      {showEntry && missing.length > 0 && (
        <div className="sp-entry">
          <div className="sp-entry-head">
            <h3>Type a grade, press Enter</h3>
            <span className="sp-dim">{missing.length} without one</span>
          </div>
          <ul className="sp-entry-list">
            {missing.slice(0, 12).map((c) => (
              <li key={c.id}>
                <label className="sp-entry-row">
                  <span className="sp-entry-name" title={c.name}>
                    {c.name}
                  </span>
                  <span className="sp-entry-term">{termLabel(c.year, c.semester)}</span>
                  <input
                    className="sp-entry-input"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="—"
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    onBlur={() => void save(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void save(c);
                      if (e.key === "Escape") clearDraft(c.id);
                    }}
                    aria-label={`Grade for ${c.name}`}
                  />
                </label>
              </li>
            ))}
          </ul>
          {missing.length > 12 && (
            <p className="sp-block-note">
              {missing.length - 12} more are editable in the courses table below.
            </p>
          )}
        </div>
      )}

      {!hasChart && missing.length === 0 && (
        <p className="sp-block-note">
          Grades show up here once a course is completed with a grade and a year.
        </p>
      )}
    </section>
  );
};

export default GradesPanel;
