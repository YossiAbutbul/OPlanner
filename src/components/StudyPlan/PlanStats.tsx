import React from "react";
import { CalendarCheck, Coins, GraduationCap, Layers, TrendingUp } from "lucide-react";
import Donut from "./Donut";
import type { PlanConfig } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits, formatGrade, formatMoney } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
}

const ACCENT = "var(--color-accent)";
const AMBER = "#f0a52a";

// Summary strip: the degree ring plus five read-at-a-glance tiles. Everything
// sits on the light work surface — no dark card.
const PlanStatsRow: React.FC<Props> = ({ stats, config }) => {
  const currency = config.cost.currency;
  const donePct = Math.round(Math.min(100, stats.progressPct));
  const perCourse = config.cost.pricingMode === "PER_COURSE";
  const trend =
    stats.byYear.length >= 2
      ? stats.byYear[stats.byYear.length - 1].average - stats.byYear[stats.byYear.length - 2].average
      : null;

  // Sparkline over the yearly averages, scaled inside its own range.
  const spark = (() => {
    if (stats.byYear.length < 2) return null;
    const values = stats.byYear.map((y) => y.average);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 76 + 2;
        const y = 20 - ((v - min) / span) * 16;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const last = points.split(" ").pop()?.split(",") ?? ["0", "0"];
    return { points, cx: last[0], cy: last[1] };
  })();

  return (
    <div className="sp-summary">
      <section className="sp-card sp-card-credits">
        <Donut
          size={104}
          thickness={12}
          total={Math.max(stats.creditsRequired, stats.creditsDone + stats.creditsActive)}
          segments={[
            { value: stats.creditsDone, color: ACCENT },
            { value: stats.creditsActive, color: AMBER },
          ]}
          label={<span className="sp-donut-big">{donePct}%</span>}
          sub="of degree"
          ariaLabel="Degree progress"
          ariaValue={donePct}
        />
        <div className="sp-credits-meta">
          <div className="sp-card-label">
            <Layers size={14} />
            Credits
          </div>
          <div className="sp-credits-value">
            {formatCredits(stats.creditsDone)}
            <small> / {formatCredits(stats.creditsRequired)}</small>
          </div>
          <ul className="sp-key">
            <li>
              <i className="sp-sw sp-sw-done" />
              {formatCredits(stats.creditsDone)} done
            </li>
            <li>
              <i className="sp-sw sp-sw-active" />
              {formatCredits(stats.creditsActive)} in progress
            </li>
            <li>
              <i className="sp-sw sp-sw-left" />
              {formatCredits(stats.creditsLeft)} left
            </li>
          </ul>
        </div>
      </section>

      <div className="sp-tiles">
        <section className="sp-card sp-tile sp-tile-grade">
          <div className="sp-card-label">
            <TrendingUp size={14} />
            Average
          </div>
          <div className="sp-tile-value">{formatGrade(stats.average)}</div>
          <div className="sp-tile-sub">
            {trend !== null && Math.abs(trend) >= 0.05 && (
              <span className={trend > 0 ? "sp-up" : "sp-down"}>
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}
              </span>
            )}
            {config.targetAverage
              ? ` target ${config.targetAverage}`
              : stats.average === null
                ? "no graded courses yet"
                : " weighted by credits"}
          </div>
          {spark && (
            <svg className="sp-spark" viewBox="0 0 80 24" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={spark.points} />
              <circle cx={spark.cx} cy={spark.cy} r="2.4" />
            </svg>
          )}
        </section>

        <section className="sp-card sp-tile sp-tile-courses">
          <div className="sp-card-label">
            <CalendarCheck size={14} />
            Courses
          </div>
          <div className="sp-tile-value">
            {stats.statusCounts.COMPLETED +
              stats.statusCounts.IN_PROGRESS +
              stats.statusCounts.PLANNED +
              stats.statusCounts.EXEMPT +
              stats.statusCounts.FAILED +
              stats.statusCounts.DROPPED}
          </div>
          <div className="sp-status-bar" aria-hidden="true">
            <i className="sp-sb-done" style={{ flexGrow: stats.statusCounts.COMPLETED }} />
            <i className="sp-sb-now" style={{ flexGrow: stats.statusCounts.IN_PROGRESS }} />
            <i className="sp-sb-plan" style={{ flexGrow: stats.statusCounts.PLANNED }} />
            <i className="sp-sb-fail" style={{ flexGrow: stats.statusCounts.FAILED }} />
          </div>
          <div className="sp-tile-sub">
            {stats.statusCounts.COMPLETED} done · {stats.statusCounts.IN_PROGRESS} now ·{" "}
            {stats.statusCounts.PLANNED} planned
          </div>
        </section>

        <section className="sp-card sp-tile sp-tile-money">
          <div className="sp-card-label">
            <Coins size={14} />
            Money
          </div>
          <div className="sp-tile-value">{formatMoney(stats.money.spent, currency)}</div>
          <div className="sp-split sp-split-slim" aria-hidden="true">
            <i
              className="sp-split-paid"
              style={{ flexGrow: Math.max(0, stats.money.spent) || 0.001 }}
            />
            <i className="sp-split-due" style={{ flexGrow: Math.max(0, stats.money.due) }} />
            <i className="sp-split-future" style={{ flexGrow: stats.money.projected }} />
          </div>
          <div className="sp-tile-sub">
            paid, {formatMoney(stats.money.due + stats.money.projected, currency)} left
            {perCourse && stats.money.coursesLeftToPay !== null
              ? stats.money.coursesLeftToPay === 0
                ? " (rest is free)"
                : ` (${stats.money.coursesLeftToPay} paid courses left)`
              : ""}
          </div>
        </section>

        <section className="sp-card sp-tile sp-tile-grad">
          <div className="sp-card-label">
            <GraduationCap size={14} />
            Graduation
          </div>
          <div className="sp-tile-value sp-tile-term">{stats.graduationTerm ?? "—"}</div>
          <div className="sp-tile-sub">
            {stats.semestersRemaining > 0
              ? `${stats.semestersRemaining} semesters · ${stats.creditsPerSemesterNeeded.toFixed(1)} cr each`
              : "all credits earned"}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlanStatsRow;
