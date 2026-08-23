import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  onConfigure: () => void;
  /** Set how many credits a group needs, straight from this panel. */
  onSetTarget: (groupId: string, credits: number) => Promise<void>;
}

// Credits per requirement group. A group with no target still shows what it
// has earned, measured against the degree, and offers to set the target here
// rather than sending the user to Settings.
const RequirementsPanel: React.FC<Props> = ({ stats, onConfigure, onSetTarget }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commit = async (groupId: string) => {
    setEditing(null);
    const value = Number(draft.trim());
    if (!Number.isFinite(value) || value < 0) return;
    await onSetTarget(groupId, value);
  };

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
          {stats.byGroup.map((g) => {
            const hasTarget = g.required > 0;
            // Without a target, measure the group against the whole degree so
            // the bar still says something true.
            const sharePct =
              stats.creditsRequired > 0 ? (g.done / stats.creditsRequired) * 100 : 0;
            const pct = hasTarget ? g.pct : sharePct;
            const activePct = hasTarget
              ? Math.min(100 - pct, (g.active / g.required) * 100)
              : stats.creditsRequired > 0
                ? Math.min(100 - pct, (g.active / stats.creditsRequired) * 100)
                : 0;

            return (
              <div className="sp-req-row" key={g.group.id}>
                <div className="sp-req-top">
                  <i
                    className="sp-dot"
                    style={{ background: g.group.color || "var(--color-accent)" }}
                  />
                  <span className="sp-req-name">{g.group.label}</span>

                  {editing === g.group.id ? (
                    <input
                      className="sp-req-input"
                      type="number"
                      min={0}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => void commit(g.group.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commit(g.group.id);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      aria-label={`Credits required for ${g.group.label}`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="sp-req-num"
                      title="Click to set how many credits this group needs"
                      onClick={() => {
                        setEditing(g.group.id);
                        setDraft(hasTarget ? String(g.required) : "");
                      }}
                    >
                      <b>{formatCredits(g.done)}</b>
                      {hasTarget ? ` / ${formatCredits(g.required)}` : " cr"}
                      {g.active > 0 && (
                        <span className="sp-req-active"> · {formatCredits(g.active)} now</span>
                      )}
                      {!hasTarget && <span className="sp-req-set"> set target</span>}
                    </button>
                  )}
                </div>

                <div
                  className={`sp-bar ${hasTarget ? "" : "sp-bar-untargeted"}`}
                  role="progressbar"
                  aria-label={`${g.group.label} progress`}
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    data-level={hasTarget ? g.level : undefined}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                  {activePct > 0 && (
                    <span className="sp-bar-active" style={{ width: `${activePct}%` }} />
                  )}
                </div>

                <div className="sp-req-foot">
                  {hasTarget
                    ? g.required > g.done
                      ? `${Math.round(g.pct)}% · ${formatCredits(g.required - g.done)} credits left`
                      : "complete"
                    : `${Math.round(sharePct)}% of the degree`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassigned > 0 && (
        <p className="sp-hint">
          {formatCredits(unassigned)} earned credits are not in any group yet.
        </p>
      )}
    </section>
  );
};

export default RequirementsPanel;
