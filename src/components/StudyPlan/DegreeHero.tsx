import React from "react";
import CreditsChart from "./CreditsChart";
import type { PlanConfig } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits, formatGrade, formatMoney } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
  onOpenSettings: () => void;
}

// The whole degree in one glance: the ring carries the headline number, the
// bar carries the split, and three facts sit underneath. Nothing else on the
// page is allowed to be this large.
const DegreeHero: React.FC<Props> = ({ stats, config, onOpenSettings }) => {
  const donePct = Math.round(Math.min(100, stats.progressPct));
  const currency = config.cost.currency;
  const priced =
    config.cost.pricePerCredit > 0 ||
    (config.cost.pricePerCourse ?? 0) > 0 ||
    config.cost.perSemesterFee > 0 ||
    stats.money.spent !== 0;

  const width = (value: number) =>
    stats.creditsRequired > 0
      ? `${Math.min(100, (value / stats.creditsRequired) * 100)}%`
      : "0%";

  return (
    <>
      <section className="sp-hero">
        <div className="sp-hero-top">
          <CreditsChart
            done={stats.creditsDone}
            active={stats.creditsActive}
            left={stats.creditsLeft}
            pct={donePct}
          />
        </div>

        <div className="sp-hero-credits">
          <p className="sp-hero-credits-num">
            {formatCredits(stats.creditsDone)}
            <span className="sp-hero-credits-of">/ {formatCredits(stats.creditsRequired)}</span>
          </p>
          <p className="sp-hero-credits-label">credits earned</p>

          <div className="sp-hero-bar" aria-hidden="true">
            <i className="sp-seg-done" style={{ width: width(stats.creditsDone) }} />
            <i className="sp-seg-active" style={{ width: width(stats.creditsActive) }} />
          </div>

          <ul className="sp-hero-key">
            <li>
              <i className="sp-sw sp-sw-done" />
              <b>{formatCredits(stats.creditsDone)}</b> earned
            </li>
            <li>
              <i className="sp-sw sp-sw-active" />
              <b>{formatCredits(stats.creditsActive)}</b> running
            </li>
            <li>
              <i className="sp-sw sp-sw-left" />
              <b>{formatCredits(stats.creditsLeft)}</b> to go
            </li>
          </ul>
        </div>
      </section>

      <dl className="sp-hero-facts">
        <div className="sp-hero-fact">
          <dt>Finishing</dt>
          <dd>{stats.graduationTerm ?? "—"}</dd>
          <span className="sp-hero-fact-sub">
            {stats.semestersRemaining > 0
              ? `${stats.semestersRemaining} semester${
                  stats.semestersRemaining === 1 ? "" : "s"
                } left at ~${stats.pace.toFixed(0)} credits each`
              : "all credits earned"}
          </span>
        </div>

        <div className="sp-hero-fact">
          <dt>Average</dt>
          <dd className={stats.average === null ? "sp-dim" : undefined}>
            {formatGrade(stats.average)}
          </dd>
          <span className="sp-hero-fact-sub">
            {stats.average === null
              ? "no grades yet"
              : `over ${stats.gradedCount} graded course${stats.gradedCount === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="sp-hero-fact">
          <dt>Still to pay</dt>
          {priced ? (
            <>
              <dd>{formatMoney(stats.money.due + stats.money.projected, currency)}</dd>
              <span className="sp-hero-fact-sub">
                {formatMoney(stats.money.spent, currency)} paid so far
              </span>
            </>
          ) : (
            <>
              <dd className="sp-dim">—</dd>
              <button type="button" className="sp-link-btn" onClick={onOpenSettings}>
                Set your tuition
              </button>
            </>
          )}
        </div>
      </dl>
    </>
  );
};

export default DegreeHero;
