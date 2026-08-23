import React from "react";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
}

// Credits carried per semester, stacked by what is earned, running and
// planned. Shows the real workload pattern across the degree.
const TermsPanel: React.FC<Props> = ({ stats }) => {
  const terms = stats.byTerm;
  const max = Math.max(1, ...terms.map((t) => t.done + t.active + t.planned));
  const average =
    terms.length > 0
      ? terms.reduce((s, t) => s + t.done + t.active + t.planned, 0) / terms.length
      : 0;

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <h3>Credits per semester</h3>
        <span className="sp-hint">
          {terms.length > 0 ? `${average.toFixed(1)} on average` : "credits by term"}
        </span>
      </div>

      {terms.length === 0 ? (
        <p className="sp-empty-line">
          Give courses a year and semester to see how the load spreads across
          the degree.
        </p>
      ) : (
        <>
          <div className="sp-terms">
            {terms.map((t) => {
              const total = t.done + t.active + t.planned;
              const h = (v: number) => `${(v / max) * 100}%`;
              return (
                <div className="sp-term" key={`${t.year}-${t.semester}`}>
                  <span className="sp-term-total">{formatCredits(total)}</span>
                  <div className="sp-term-stack" title={`${t.courses} courses`}>
                    {t.planned > 0 && (
                      <i className="sp-term-planned" style={{ height: h(t.planned) }} />
                    )}
                    {t.active > 0 && (
                      <i className="sp-term-active" style={{ height: h(t.active) }} />
                    )}
                    {t.done > 0 && <i className="sp-term-done" style={{ height: h(t.done) }} />}
                  </div>
                  <span className="sp-term-label">{t.label}</span>
                </div>
              );
            })}
          </div>
          <div className="sp-legend">
            <span>
              <i className="sp-sw sp-sw-done" />
              earned
            </span>
            <span>
              <i className="sp-sw sp-sw-active" />
              in progress
            </span>
            <span>
              <i className="sp-sw sp-sw-planned" />
              planned
            </span>
          </div>
        </>
      )}
    </section>
  );
};

export default TermsPanel;
