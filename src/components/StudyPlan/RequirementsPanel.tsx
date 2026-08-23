import React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  onConfigure: () => void;
}

// Credits per requirement group. Groups with no required credits set still
// show what has been earned, so the panel is useful before setup is finished.
const RequirementsPanel: React.FC<Props> = ({ stats, onConfigure }) => {
  const unassigned = Math.max(
    0,
    stats.creditsDone - stats.byGroup.reduce((sum, g) => sum + g.done, 0)
  );

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <h3>Requirements</h3>
        <button type="button" className="sp-link-btn" onClick={onConfigure}>
          <SlidersHorizontal size={14} />
          Edit groups
        </button>
      </div>

      {stats.byGroup.length === 0 ? (
        <p className="sp-empty-line">
          No requirement groups yet. Add them in Settings to split the degree
          into mandatory, elective and general credits.
        </p>
      ) : (
        <div className="sp-req">
          {stats.byGroup.map((g) => (
            <div className="sp-req-row" key={g.group.id}>
              <div className="sp-req-top">
                <i
                  className="sp-dot"
                  style={{ background: g.group.color || "var(--color-accent)" }}
                />
                <span className="sp-req-name">{g.group.label}</span>
                <span className="sp-req-num">
                  <b>{formatCredits(g.done)}</b>
                  {g.required > 0 ? ` / ${formatCredits(g.required)}` : " credits"}
                </span>
              </div>
              <div
                className="sp-bar"
                role="progressbar"
                aria-label={`${g.group.label} progress`}
                aria-valuenow={Math.round(g.pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span data-level={g.level} style={{ width: `${g.required > 0 ? g.pct : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {unassigned > 0 && (
        <p className="sp-hint">
          {formatCredits(unassigned)} earned credits are not assigned to a group yet.
        </p>
      )}
    </section>
  );
};

export default RequirementsPanel;
