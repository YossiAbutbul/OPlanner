import React, { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { PlanConfig, PlanCourse } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { effectiveGrade } from "../../hooks/usePlanStats";
import { formatGrade, termLabel } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
  courses: PlanCourse[];
  onSetGrade: (course: PlanCourse, grade: number | undefined) => Promise<void>;
}

// Bars are scaled inside a window around the data rather than 0-100, so a
// two-point year-over-year move is actually visible.
const FLOOR = 50;
const CEIL = 100;
const scale = (grade: number) =>
  Math.max(8, Math.min(100, ((grade - FLOOR) / (CEIL - FLOOR)) * 100));

const GradesPanel: React.FC<Props> = ({ stats, config, courses, onSetGrade }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [entryOpen, setEntryOpen] = useState(false);

  const hasChart = stats.byYear.length > 0;
  const target = config.targetAverage;

  // Courses that are done or running but carry no grade yet.
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
    <section className="sp-panel">
      <header className="sp-panel-head">
        <h3>Grades</h3>
        {missing.length > 0 && (
          <button
            type="button"
            className="sp-link-btn"
            onClick={() => setEntryOpen((v) => !v)}
          >
            {showEntry && entryOpen ? <X size={14} /> : <Plus size={14} />}
            {showEntry && entryOpen ? "Close" : `Add grades (${missing.length})`}
          </button>
        )}
      </header>

      <div className="sp-grade-head">
        {stats.average !== null && (
          <div className="sp-grade-big">
            {formatGrade(stats.average)}
            {target !== undefined && <span className="sp-grade-target">target {target}</span>}
          </div>
        )}
        <p className="sp-grade-note">
          {stats.average === null
            ? "Weighted average across your graded courses. Add a grade to get started."
            : `Weighted by credits across ${stats.gradedCount} course${
                stats.gradedCount === 1 ? "" : "s"
              }.${
                stats.projectedAverage !== null &&
                Math.abs(stats.projectedAverage - stats.average) >= 0.05
                  ? ` Projected ${formatGrade(stats.projectedAverage)} with courses in progress.`
                  : ""
              }`}
        </p>
      </div>

      {hasChart && (
        <div
          className="sp-chart"
          style={{ gridTemplateColumns: `repeat(${stats.byYear.length}, minmax(0, 1fr))` }}
        >
          <div className="sp-gridline" style={{ bottom: "82%" }} />
          <div className="sp-gridline" style={{ bottom: "46%" }} />
          {target !== undefined && target > FLOOR && (
            <div className="sp-target" style={{ bottom: `${scale(target)}%` }}>
              <span>target</span>
            </div>
          )}
          {stats.byYear.map((y) => (
            <div className="sp-col" key={y.year}>
              <span className="sp-col-val">{formatGrade(y.average)}</span>
              <div
                className="sp-col-fill"
                style={{ height: `${scale(y.average)}%` }}
                title={`${y.credits} credits graded in ${y.year}`}
              />
              <span className="sp-col-cap">{y.year}</span>
            </div>
          ))}
        </div>
      )}

      {showEntry && missing.length > 0 && (
        <div className="sp-fill">
          <div className="sp-fill-head">
            <h4>Type a grade, press Enter</h4>
            <span className="sp-hint">{missing.length} without one</span>
          </div>
          <div className="sp-fill-list">
            {missing.slice(0, 12).map((c) => (
              <label className="sp-fill-row" key={c.id}>
                <span className="sp-fill-name" title={c.name}>
                  {c.name}
                </span>
                <span className="sp-fill-term">{termLabel(c.year, c.semester)}</span>
                <input
                  className="sp-fill-input"
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
            ))}
          </div>
          {missing.length > 12 && (
            <p className="sp-hint">
              {missing.length - 12} more in the courses table, where grades are editable too.
            </p>
          )}
        </div>
      )}

      {!hasChart && missing.length === 0 && (
        <p className="sp-empty-line">
          Grades appear here once a course is completed with a grade and a year.
        </p>
      )}
    </section>
  );
};

export default GradesPanel;
