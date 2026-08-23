import React from "react";
import type { PlanConfig } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatGrade } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
}

// Bars are scaled inside a window around the data rather than 0-100, so a
// two-point year-over-year move is actually visible.
const FLOOR = 50;
const CEIL = 100;
const scale = (grade: number) =>
  Math.max(6, Math.min(100, ((grade - FLOOR) / (CEIL - FLOOR)) * 100));

const GradesPanel: React.FC<Props> = ({ stats, config }) => {
  const hasData = stats.byYear.length > 0;
  const target = config.targetAverage;
  const projectedOnly =
    stats.projectedAverage !== null &&
    stats.average !== null &&
    Math.abs(stats.projectedAverage - stats.average) >= 0.05;

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <h3>Average by year</h3>
        <span className="sp-hint">weighted by credits</span>
      </div>

      {!hasData ? (
        <p className="sp-empty-line">
          Grades appear here once a course is completed with a grade and a year.
        </p>
      ) : (
        <>
          <div className="sp-chart" style={{ gridTemplateColumns: `repeat(${stats.byYear.length}, minmax(0, 1fr))` }}>
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
                <div className="sp-col-fill" style={{ height: `${scale(y.average)}%` }} />
                <div className="sp-col-cap">{y.year}</div>
              </div>
            ))}
          </div>
          <div className="sp-hint">
            Overall {formatGrade(stats.average)}
            {projectedOnly && (
              <> &middot; projected {formatGrade(stats.projectedAverage)} with courses in progress</>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default GradesPanel;
