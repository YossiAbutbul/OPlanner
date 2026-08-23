import React from "react";
import type { PlanConfig } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits, formatGrade, formatMoney } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
}

const RADIUS = 38;
const CIRC = 2 * Math.PI * RADIUS;

// Hero credits ring plus the four supporting numbers. The ring shows earned
// credits in accent green and in-progress credits in amber on the same track,
// so "where am I" reads before any table does.
const PlanStatsRow: React.FC<Props> = ({ stats, config }) => {
  const donePct = Math.min(100, stats.progressPct);
  const activePct = Math.min(100 - donePct, stats.activePct);
  const doneDash = (donePct / 100) * CIRC;
  const activeDash = (activePct / 100) * CIRC;
  const currency = config.cost.currency;

  return (
    <div className="sp-hero">
      <div className="sp-hero-card">
        <div
          className="sp-ring"
          role="progressbar"
          aria-label="Degree progress"
          aria-valuenow={Math.round(donePct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
            <circle cx="46" cy="46" r={RADIUS} className="sp-ring-track" />
            <circle
              cx="46"
              cy="46"
              r={RADIUS}
              className="sp-ring-done"
              strokeDasharray={`${doneDash} ${CIRC}`}
            />
            <circle
              cx="46"
              cy="46"
              r={RADIUS}
              className="sp-ring-active"
              strokeDasharray={`${activeDash} ${CIRC}`}
              strokeDashoffset={-doneDash - 2}
            />
          </svg>
          <div className="sp-ring-mid">
            <div className="sp-ring-big">{Math.round(donePct)}%</div>
            <div className="sp-ring-small">of degree</div>
          </div>
        </div>

        <div className="sp-hero-meta">
          <span className="sp-hero-k">Credits</span>
          <span className="sp-hero-v">
            {formatCredits(stats.creditsDone)}{" "}
            <small>/ {formatCredits(stats.creditsRequired)}</small>
          </span>
          <div className="sp-hero-legend">
            <span>
              <i className="sp-sw sp-sw-done" />
              {formatCredits(stats.creditsDone)} done
            </span>
            <span>
              <i className="sp-sw sp-sw-active" />
              {formatCredits(stats.creditsActive)} in progress
            </span>
            <span>
              <i className="sp-sw sp-sw-left" />
              {formatCredits(stats.creditsLeft)} left
            </span>
          </div>
        </div>
      </div>

      <div className="sp-stats">
        <div className="sp-stat">
          <div className="sp-stat-label">Average</div>
          <div className={`sp-stat-value ${stats.average !== null ? "sp-good" : ""}`}>
            {formatGrade(stats.average)}
          </div>
          <div className="sp-stat-sub">
            {config.targetAverage
              ? `target ${config.targetAverage}`
              : stats.projectedAverage !== null && stats.average !== null
                ? `projected ${formatGrade(stats.projectedAverage)}`
                : "no graded courses yet"}
          </div>
        </div>

        <div className="sp-stat">
          <div className="sp-stat-label">Paid</div>
          <div className="sp-stat-value">{formatMoney(stats.money.spent, currency)}</div>
          <div className="sp-stat-sub">
            {stats.money.perCredit > 0
              ? `${formatMoney(stats.money.perCredit, currency)} per credit`
              : "no payments yet"}
          </div>
        </div>

        <div className="sp-stat">
          <div className="sp-stat-label">Left to pay</div>
          <div className="sp-stat-value">
            {formatMoney(stats.money.due + stats.money.projected, currency)}
          </div>
          <div className="sp-stat-sub">
            {stats.money.due > 0
              ? `${formatMoney(stats.money.due, currency)} already billed`
              : `${stats.semestersRemaining} semesters projected`}
          </div>
        </div>

        <div className="sp-stat">
          <div className="sp-stat-label">Graduation</div>
          <div className="sp-stat-value sp-stat-term">
            {stats.graduationTerm ?? "—"}
          </div>
          <div className="sp-stat-sub">
            {stats.semestersRemaining > 0
              ? `${stats.semestersRemaining} semesters left`
              : "all credits earned"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanStatsRow;
