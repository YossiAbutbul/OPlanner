import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "../Modal";
import CustomSelect from "../CustomSelect";
import { CURRENCIES, MAX_FEES, MAX_GROUPS } from "../../services/plan";
import type { PlanConfig, RequirementGroup } from "../../types/models";

interface Props {
  isOpen: boolean;
  config: PlanConfig;
  onClose: () => void;
  onSave: (config: PlanConfig) => Promise<void>;
}

const GROUP_COLORS = ["#1db954", "#5b8def", "#c0a35e", "#d9698a", "#9b6cd6", "#3fb6a8"];

const numOrZero = (v: string): number => {
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const PlanSettingsModal: React.FC<Props> = ({ isOpen, config, onClose, onSave }) => {
  const [draft, setDraft] = useState<PlanConfig>(config);
  const [total, setTotal] = useState("");
  const [perCredit, setPerCredit] = useState("");
  const [perSemester, setPerSemester] = useState("");
  const [target, setTarget] = useState("");
  const [passMark, setPassMark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(config);
    setTotal(String(config.totalCreditsRequired || ""));
    setPerCredit(String(config.cost.pricePerCredit || ""));
    setPerSemester(String(config.cost.perSemesterFee || ""));
    setTarget(config.targetAverage !== undefined ? String(config.targetAverage) : "");
    setPassMark(String(config.passMark ?? 60));
    setError(null);
    setSaving(false);
  }, [isOpen, config]);

  const updateGroup = (id: string, patch: Partial<RequirementGroup>) =>
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));

  const handleSave = async () => {
    const name = draft.degreeName.trim();
    if (!name) {
      setError("Give the degree a name.");
      return;
    }
    const targetNum = target.trim() ? Number(target) : undefined;
    if (targetNum !== undefined && (!Number.isFinite(targetNum) || targetNum < 0 || targetNum > 100)) {
      setError("Target average must be between 0 and 100.");
      return;
    }

    const next: PlanConfig = {
      ...draft,
      degreeName: name,
      institution: draft.institution?.trim() || undefined,
      totalCreditsRequired: numOrZero(total),
      passMark: numOrZero(passMark) || 60,
      targetAverage: targetNum,
      groups: draft.groups
        .filter((g) => g.label.trim())
        .map((g) => ({ ...g, label: g.label.trim() })),
      cost: {
        ...draft.cost,
        pricePerCredit: numOrZero(perCredit),
        perSemesterFee: numOrZero(perSemester),
        oneTimeFees: draft.cost.oneTimeFees.filter((f) => f.label.trim()),
      },
      updatedAt: Date.now(),
    };

    try {
      setSaving(true);
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Study plan settings"
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="app-modal-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </>
      }
    >
      <div className="sp-form">
        <div className="sp-field">
          <label htmlFor="sp-degree">Degree</label>
          <input
            id="sp-degree"
            type="text"
            value={draft.degreeName}
            onChange={(e) => setDraft({ ...draft, degreeName: e.target.value })}
            placeholder="B.Sc. Software Engineering"
          />
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label htmlFor="sp-institution">Institution</label>
            <input
              id="sp-institution"
              type="text"
              value={draft.institution ?? ""}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              placeholder="Braude College"
            />
          </div>
          <div className="sp-field">
            <label htmlFor="sp-total">Credits required</label>
            <input
              id="sp-total"
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="160"
            />
          </div>
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label htmlFor="sp-target">Target average</label>
            <input
              id="sp-target"
              type="number"
              min={0}
              max={100}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="90"
            />
          </div>
          <div className="sp-field">
            <label htmlFor="sp-pass">Pass mark</label>
            <input
              id="sp-pass"
              type="number"
              min={0}
              max={100}
              value={passMark}
              onChange={(e) => setPassMark(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>

        <div className="sp-parts">
          <div className="sp-parts-head">
            <h4>Requirement groups</h4>
            <span className="sp-hint">credits needed in each</span>
          </div>
          {draft.groups.map((g) => (
            <div className="sp-group-row" key={g.id}>
              <span
                className="sp-group-color"
                style={{ background: g.color || "#1db954" }}
                onClick={() => {
                  const i = GROUP_COLORS.indexOf(g.color || "#1db954");
                  updateGroup(g.id, { color: GROUP_COLORS[(i + 1) % GROUP_COLORS.length] });
                }}
                role="button"
                tabIndex={0}
                aria-label={`Change color of ${g.label}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    const i = GROUP_COLORS.indexOf(g.color || "#1db954");
                    updateGroup(g.id, { color: GROUP_COLORS[(i + 1) % GROUP_COLORS.length] });
                  }
                }}
              />
              <input
                type="text"
                value={g.label}
                onChange={(e) => updateGroup(g.id, { label: e.target.value })}
                placeholder="Mandatory"
                aria-label="Group name"
              />
              <input
                type="number"
                min={0}
                value={g.requiredCredits || ""}
                onChange={(e) => updateGroup(g.id, { requiredCredits: numOrZero(e.target.value) })}
                placeholder="credits"
                aria-label="Required credits"
              />
              <button
                type="button"
                className="sp-danger"
                onClick={() =>
                  setDraft((d) => ({ ...d, groups: d.groups.filter((x) => x.id !== g.id) }))
                }
                aria-label={`Remove ${g.label || "group"}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {draft.groups.length < MAX_GROUPS && (
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  groups: [
                    ...d.groups,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      requiredCredits: 0,
                      color: GROUP_COLORS[d.groups.length % GROUP_COLORS.length],
                    },
                  ],
                }))
              }
            >
              <Plus size={14} />
              Add group
            </button>
          )}
        </div>

        <div className="sp-parts">
          <div className="sp-parts-head">
            <h4>Cost model</h4>
            <span className="sp-hint">drives the money projection</span>
          </div>
          <div className="sp-field-row">
            <div className="sp-field">
              <label>Currency</label>
              <CustomSelect
                value={draft.cost.currency}
                options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))}
                onChange={(v) => setDraft({ ...draft, cost: { ...draft.cost, currency: v } })}
              />
            </div>
            <div className="sp-field">
              <label htmlFor="sp-per-credit">Price per credit</label>
              <input
                id="sp-per-credit"
                type="number"
                min={0}
                value={perCredit}
                onChange={(e) => setPerCredit(e.target.value)}
                placeholder="416"
              />
            </div>
          </div>
          <div className="sp-field-row">
            <div className="sp-field">
              <label htmlFor="sp-per-sem">Fee per semester</label>
              <input
                id="sp-per-sem"
                type="number"
                min={0}
                value={perSemester}
                onChange={(e) => setPerSemester(e.target.value)}
                placeholder="610"
              />
            </div>
            <div className="sp-field">
              <label htmlFor="sp-sem-left">Semesters left</label>
              <input
                id="sp-sem-left"
                type="number"
                min={0}
                value={draft.cost.semestersRemainingOverride ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    cost: {
                      ...draft.cost,
                      semestersRemainingOverride: e.target.value.trim()
                        ? numOrZero(e.target.value)
                        : undefined,
                    },
                  })
                }
                placeholder="auto"
              />
            </div>
          </div>

          {draft.cost.oneTimeFees.map((fee) => (
            <div className="sp-group-row" key={fee.id}>
              <input
                type="text"
                value={fee.label}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cost: {
                      ...d.cost,
                      oneTimeFees: d.cost.oneTimeFees.map((f) =>
                        f.id === fee.id ? { ...f, label: e.target.value } : f
                      ),
                    },
                  }))
                }
                placeholder="Graduation fee"
                aria-label="Fee name"
              />
              <input
                type="number"
                min={0}
                value={fee.amount || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cost: {
                      ...d.cost,
                      oneTimeFees: d.cost.oneTimeFees.map((f) =>
                        f.id === fee.id ? { ...f, amount: numOrZero(e.target.value) } : f
                      ),
                    },
                  }))
                }
                placeholder="amount"
                aria-label="Fee amount"
              />
              <label className="sp-fee-paid">
                <input
                  type="checkbox"
                  checked={fee.paid === true}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      cost: {
                        ...d.cost,
                        oneTimeFees: d.cost.oneTimeFees.map((f) =>
                          f.id === fee.id ? { ...f, paid: e.target.checked } : f
                        ),
                      },
                    }))
                  }
                />
                paid
              </label>
              <button
                type="button"
                className="sp-danger"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    cost: {
                      ...d.cost,
                      oneTimeFees: d.cost.oneTimeFees.filter((f) => f.id !== fee.id),
                    },
                  }))
                }
                aria-label={`Remove ${fee.label || "fee"}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {draft.cost.oneTimeFees.length < MAX_FEES && (
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  cost: {
                    ...d.cost,
                    oneTimeFees: [
                      ...d.cost.oneTimeFees,
                      { id: crypto.randomUUID(), label: "", amount: 0 },
                    ],
                  },
                }))
              }
            >
              <Plus size={14} />
              Add one-time fee
            </button>
          )}
        </div>

        {error && <p className="sp-error">{error}</p>}
      </div>
    </Modal>
  );
};

export default PlanSettingsModal;
