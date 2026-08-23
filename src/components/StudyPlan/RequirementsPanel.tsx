import React, { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  onConfigure: () => void;
  /** Set how many credits a group needs, straight from this panel. */
  onSetTarget: (groupId: string, credits: number) => Promise<void>;
}

// Credits per requirement group. Groups that carry nothing and have no target
// are folded away so the panel shows the ones that matter.
const RequirementsPanel: React.FC<Props> = ({ stats, onConfigure, onSetTarget }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  const { active, empty } = useMemo(() => {
    const withContent = stats.byGroup.filter(
      (g) => g.required > 0 || g.done > 0 || g.active > 0
    );
    return {
      active: [...withContent].sort((a, b) => b.done + b.active - (a.done + a.active)),
      empty: stats.byGroup.filter((g) => !(g.required > 0 || g.done > 0 || g.active > 0)),
    };
  }, [stats.byGroup]);

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

  const row = (g: (typeof stats.byGroup)[number]) => {
    const hasTarget = g.required > 0;
    const denominator = hasTarget ? g.required : Math.max(1, stats.creditsRequired);
    const donePct = Math.min(100, (g.done / denominator) * 100);
    const activePct = Math.min(100 - donePct, (g.active / denominator) * 100);

    return (
      <li className="sp-req-row" key={g.group.id}>
        <div className="sp-req-line">
          <i className="sp-dot" style={{ background: g.group.color || "var(--color-accent)" }} />
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
              <span className="sp-req-den">
                {hasTarget ? ` / ${formatCredits(g.required)}` : " cr"}
              </span>
            </button>
          )}
        </div>

        <div
          className="sp-bar"
          role="progressbar"
          aria-label={`${g.group.label} progress`}
          aria-valuenow={Math.round(donePct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i
            className="sp-bar-done"
            style={{
              width: `${donePct}%`,
              background: g.group.color || "var(--color-accent)",
            }}
          />
          {activePct > 0 && <i className="sp-bar-active" style={{ width: `${activePct}%` }} />}
        </div>

        <div className="sp-req-foot">
          {hasTarget ? (
            g.done >= g.required ? (
              <span className="sp-req-done">complete</span>
            ) : (
              <>
                {Math.round(g.pct)}% &middot; {formatCredits(g.required - g.done)} to go
                {g.active > 0 && `, ${formatCredits(g.active)} running`}
              </>
            )
          ) : (
            <>
              {g.active > 0 && `${formatCredits(g.active)} running · `}
              <button
                type="button"
                className="sp-req-set"
                onClick={() => {
                  setEditing(g.group.id);
                  setDraft("");
                }}
              >
                set a target
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="sp-panel">
      <header className="sp-panel-head">
        <h3>Requirements</h3>
        <button type="button" className="sp-link-btn" onClick={onConfigure}>
          <SlidersHorizontal size={14} />
          Edit groups
        </button>
      </header>

      {stats.byGroup.length === 0 ? (
        <p className="sp-empty-line">
          No requirement groups yet. Add them in Settings to split the degree into
          mandatory, elective and general credits.
        </p>
      ) : (
        <>
          <ul className="sp-req">{active.map(row)}</ul>

          {empty.length > 0 &&
            (showEmpty ? (
              <ul className="sp-req">{empty.map(row)}</ul>
            ) : (
              <button
                type="button"
                className="sp-link-btn sp-req-more"
                onClick={() => setShowEmpty(true)}
              >
                Show {empty.length} empty group{empty.length === 1 ? "" : "s"}
              </button>
            ))}
        </>
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
