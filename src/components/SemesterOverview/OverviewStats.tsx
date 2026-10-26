import React from "react";
import type { SemesterTotals } from "../../hooks/useSemesterStats";
import RollingNumber from "../RollingNumber";

interface Props {
  totals: SemesterTotals;
  completionPct: number;
}

// Summary card: an Activity-style completion ring next to the four counts,
// divided by hairlines rather than split into separate boxes.
const OverviewStats: React.FC<Props> = ({ totals, completionPct }) => (
  <section className="overview-stats" aria-label="Semester summary">
    <div className="ovs-ring-block">
      <div
        className="ovs-ring"
        role="progressbar"
        aria-label="Completion"
        aria-valuenow={completionPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className="ovs-ring-track" cx="32" cy="32" r="27" />
          <circle
            className="ovs-ring-fill"
            cx="32"
            cy="32"
            r="27"
            pathLength={100}
            style={{ strokeDasharray: `${completionPct} 100` }}
          />
        </svg>
        <span className="ovs-ring-pct">
          <RollingNumber value={completionPct} suffix="%" />
        </span>
      </div>
      <div className="ovs-ring-text">
        <span className="ovs-label">Completion</span>
        <span className="ovs-caption">
          {totals.total === 0
            ? "No tasks yet"
            : `${totals.completed} of ${totals.total} tasks done`}
        </span>
      </div>
    </div>

    <dl className="ovs-metrics">
      <div className="ovs-metric">
        <dt className="ovs-label">Tasks</dt>
        <dd className="ovs-value"><RollingNumber value={totals.total} /></dd>
      </div>
      <div className="ovs-metric" data-tone="good">
        <dt className="ovs-label">Completed</dt>
        <dd className="ovs-value"><RollingNumber value={totals.completed} /></dd>
      </div>
      <div className="ovs-metric" data-tone="warn">
        <dt className="ovs-label">Pending</dt>
        <dd className="ovs-value"><RollingNumber value={totals.pending} /></dd>
      </div>
      <div className="ovs-metric" data-tone={totals.overdue > 0 ? "bad" : "none"}>
        <dt className="ovs-label">Overdue</dt>
        <dd className="ovs-value"><RollingNumber value={totals.overdue} /></dd>
      </div>
    </dl>
  </section>
);

export default OverviewStats;
