import React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { PlanConfig, PlanPayment } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatMoney } from "../../utility/planFormat";

interface Props {
  stats: PlanStats;
  config: PlanConfig;
  payments: PlanPayment[];
  onAdd: () => void;
  onEdit: (payment: PlanPayment) => void;
  onDelete: (payment: PlanPayment) => void;
}

const KIND_LABEL: Record<PlanPayment["kind"], string> = {
  TUITION: "Tuition",
  FEE: "Fee",
  BOOKS: "Books",
  SCHOLARSHIP: "Scholarship",
  REFUND: "Refund",
  OTHER: "Other",
};

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = months[Number(m) - 1] ?? m;
  return `${d} ${label} ${y.slice(2)}`;
};

const MoneyPanel: React.FC<Props> = ({ stats, config, payments, onAdd, onEdit, onDelete }) => {
  const currency = config.cost.currency;
  const { spent, due, projected, total } = stats.money;
  const denom = Math.max(1, total);
  const pct = (value: number) => `${Math.max(0, (value / denom) * 100)}%`;

  const ordered = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <h3>Money</h3>
        <span className="sp-hint">{formatMoney(total, currency)} total degree</span>
      </div>

      <div className="sp-split" aria-hidden="true">
        <i className="sp-split-paid" style={{ width: pct(Math.max(0, spent)) }} />
        <i className="sp-split-due" style={{ width: pct(Math.max(0, due)) }} />
        <i className="sp-split-future" style={{ width: pct(projected) }} />
      </div>
      <div className="sp-legend">
        <span>
          <i className="sp-sw sp-sw-done" />
          Paid <b>{formatMoney(spent, currency)}</b>
        </span>
        <span>
          <i className="sp-sw sp-sw-active" />
          Due <b>{formatMoney(due, currency)}</b>
        </span>
        <span>
          <i className="sp-sw sp-sw-future" />
          Projected <b>{formatMoney(projected, currency)}</b>
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="sp-empty-line">
          No payments recorded. Add tuition, fees and scholarships to see what
          the degree has really cost.
        </p>
      ) : (
        <div className="sp-ledger">
          {ordered.slice(0, 6).map((p) => (
            <div className="sp-led-row" key={p.id}>
              <span className="sp-led-when">{formatDate(p.date)}</span>
              <span className="sp-led-what">
                {p.note?.trim() || KIND_LABEL[p.kind]}
                {p.semester ? ` · ${p.semester.replace("Semester ", "Sem ")}` : ""}
              </span>
              <span className={`sp-led-amt ${p.amount < 0 ? "sp-neg" : p.paid ? "" : "sp-due"}`}>
                {formatMoney(p.amount, currency)}
              </span>
              <span className="sp-led-actions">
                <button type="button" onClick={() => onEdit(p)} aria-label={`Edit payment ${formatDate(p.date)}`}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="sp-danger"
                  onClick={() => onDelete(p)}
                  aria-label={`Delete payment ${formatDate(p.date)}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {ordered.length > 6 && (
            <div className="sp-hint sp-led-more">{ordered.length - 6} more not shown</div>
          )}
        </div>
      )}

      <button type="button" className="sp-btn sp-btn-ghost sp-btn-block" onClick={onAdd}>
        <Plus size={15} />
        Add payment
      </button>
    </section>
  );
};

export default MoneyPanel;
