import React, { useMemo, useState } from "react";
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
  Math.max(6, Math.min(100, ((grade - FLOOR) / (CEIL - FLOOR)) * 100));

const GradesPanel: React.FC<Props> = ({ stats, config, courses, onSetGrade }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const hasData = stats.byYear.length > 0;
  const target = config.targetAverage;
  const projectedOnly =
    stats.projectedAverage !== null &&
    stats.average !== null &&
    Math.abs(stats.projectedAverage - stats.average) >= 0.05;

  // Courses that are done or running but carry no grade yet. They can be
  // filled in right here instead of opening each course.
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

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <h3>Average by year</h3>
        <span className="sp-hint">
          {stats.average !== null ? `overall ${stats.average.toFixed(1)}` : "weighted by credits"}
        </span>
      </div>

      {hasData && (
        <>
          <div
            className="sp-chart"
            style={{ gridTemplateColumns: `repeat(${stats.byYear.length}, minmax(0, 1fr))` }}
          >
            <div className="sp-gridline" style={{ bottom: "82%" }} />
            <div className="sp-gridline" style={{ bottom: "46%" }} />
            {target !== undefined && target > FLOOR && (
              <div className="sp-target" style={{ bottom: `${scale(target)}%` }}>
                <span>target {target}</span>
              </div>
            )}
            {stats.byYear.map((y) => (
              <div className="sp-col" key={y.year}>
                <div className="sp-col-val">{formatGrade(y.average)}</div>
                <div
                  className="sp-col-fill"
                  style={{ height: `${scale(y.average)}%` }}
                  title={`${y.credits} credits graded`}
                />
                <div className="sp-col-cap">
                  {y.year}
                  <span className="sp-col-sub">{y.credits} cr</span>
                </div>
              </div>
            ))}
          </div>
          {projectedOnly && (
            <div className="sp-hint">
              Projected {formatGrade(stats.projectedAverage)} with courses in progress.
            </div>
          )}
        </>
      )}

      {missing.length > 0 ? (
        <div className="sp-fill">
          <div className="sp-fill-head">
            <h4>Add grades</h4>
            <span className="sp-hint">
              {missing.length} course{missing.length === 1 ? "" : "s"} without one
            </span>
          </div>
          <div className="sp-fill-list">
            {missing.slice(0, 8).map((c) => (
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
                  placeholder="grade"
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
          {missing.length > 8 && (
            <p className="sp-hint">
              {missing.length - 8} more in the courses table, where grades are editable too.
            </p>
          )}
        </div>
      ) : (
        !hasData && (
          <p className="sp-empty-line">
            Grades appear here once a course is completed with a grade and a year.
          </p>
        )
      )}
    </section>
  );
};

export default GradesPanel;
