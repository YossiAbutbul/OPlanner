import React from "react";
import type { SemesterTotals } from "../../hooks/useSemesterStats";

interface Props {
  totals: SemesterTotals;
  completionPct: number;
}

const OverviewStats: React.FC<Props> = ({ totals, completionPct }) => (
  <section className="overview-stats">
    <div className="stat-card">
      <div className="stat-label">Tasks</div>
      <div className="stat-value">{totals.total}</div>
    </div>
    <div className="stat-card">
      <div className="stat-label">Completed</div>
      <div className="stat-value stat-good">{totals.completed}</div>
    </div>
    <div className="stat-card">
      <div className="stat-label">Pending</div>
      <div className="stat-value">{totals.pending}</div>
    </div>
    <div className="stat-card">
      <div className="stat-label">Overdue</div>
      <div className={`stat-value ${totals.overdue > 0 ? "stat-bad" : ""}`}>
        {totals.overdue}
      </div>
    </div>
    <div className="stat-card stat-card-wide">
      <div className="stat-label">Completion</div>
      <div className="stat-value">{completionPct}%</div>
      <div
        className="stat-bar"
        role="progressbar"
        aria-valuenow={completionPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="stat-bar-fill"
          data-level={completionPct >= 67 ? "high" : completionPct >= 34 ? "mid" : "low"}
          style={{ width: `${completionPct}%` }}
        />
      </div>
    </div>
  </section>
);

export default OverviewStats;
