import React from "react";
import Donut from "./Donut";
import type { PlanConfig } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits, formatGrade, formatMoney } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
  onOpenSettings: () => void;
}

// The one card that answers "where am I": the ring, the credit split, and the
// three facts that follow from it. Everything else on the page is detail.
const DegreeCard: React.FC<Props> = ({ stats, config, onOpenSettings }) => {
  const donePct = Math.round(Math.min(100, stats.progressPct));
  const currency = config.cost.currency;
  const leftToPay = stats.money.due + stats.money.projected;
  const hasCostModel =
    config.cost.pricePerCredit > 0 ||
    (config.cost.pricePerCourse ?? 0) > 0 ||
    config.cost.perSemesterFee > 0 ||
    stats.money.spent !== 0;

  const width = (value: number) =>
    stats.creditsRequired > 0
      ? `${Math.min(100, (value / stats.creditsRequired) * 100)}%`
      : "0%";

  return (
    <section className="sp-degree">
      <div className="sp-degree-main">
        <Donut
          size={176}
          thickness={20}
          total={Math.max(stats.creditsRequired, stats.creditsDone + stats.creditsActive)}
          segments={[
            { value: stats.creditsDone, color: "var(--color-accent)" },
            { value: stats.creditsActive, color: "#f0a52a" },
          ]}
          label={<span className="sp-donut-big">{donePct}%</span>}
          sub="of degree"
          ariaLabel="Degree progress"
          ariaValue={donePct}
        />

        <div className="sp-degree-credits">
          <h2>
            {formatCredits(stats.creditsDone)}
            <span className="sp-degree-of"> / {formatCredits(stats.creditsRequired)} credits</span>
          </h2>

          <div className="sp-degree-bar" aria-hidden="true">
            <i className="sp-seg-done" style={{ width: width(stats.creditsDone) }} />
            <i className="sp-seg-active" style={{ width: width(stats.creditsActive) }} />
          </div>

          <ul className="sp-degree-key">
            <li>
              <i className="sp-sw sp-sw-done" />
              <b>{formatCredits(stats.creditsDone)}</b> earned
            </li>
            <li>
              <i className="sp-sw sp-sw-active" />
              <b>{formatCredits(stats.creditsActive)}</b> in progress
            </li>
            <li>
              <i className="sp-sw sp-sw-left" />
              <b>{formatCredits(stats.creditsLeft)}</b> to go
            </li>
          </ul>
        </div>
      </div>

      <dl className="sp-facts">
        <div className="sp-fact">
          <dt>Average</dt>
          <dd className={stats.average !== null ? "sp-fact-good" : "sp-fact-empty"}>
            {formatGrade(stats.average)}
          </dd>
          <span className="sp-fact-sub">
            {stats.average === null
              ? "no grades yet"
              : `${stats.gradedCount} graded course${stats.gradedCount === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="sp-fact">
          <dt>Finishing</dt>
          <dd>{stats.graduationTerm ?? "—"}</dd>
          <span className="sp-fact-sub">
            {stats.semestersRemaining > 0
              ? `${stats.semestersRemaining} semester${
                  stats.semestersRemaining === 1 ? "" : "s"
                } left, ~${stats.pace.toFixed(0)} credits each`
              : "all credits earned"}
          </span>
        </div>

        <div className="sp-fact">
          <dt>Still to pay</dt>
          {hasCostModel ? (
            <>
              <dd>{formatMoney(leftToPay, currency)}</dd>
              <span className="sp-fact-sub">
                {formatMoney(stats.money.spent, currency)} paid so far
              </span>
            </>
          ) : (
            <>
              <dd className="sp-fact-empty">—</dd>
              <button type="button" className="sp-link-btn" onClick={onOpenSettings}>
                Set your tuition
              </button>
            </>
          )}
        </div>
      </dl>
    </section>
  );
};

export default DegreeCard;
