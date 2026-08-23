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

  // Paid-course cap: schools that bill per course often stop charging after a
  // fixed number of them.
  const cap = config.cost.paidCoursesCap ?? 0;
  const capPct = cap > 0 ? Math.min(100, (stats.money.coursesBilled / cap) * 100) : 0;
  const termMax = Math.max(
    1,
    ...stats.moneyByTerm.map((t) => Math.abs(t.paid + t.due))
  );

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

      {config.cost.pricingMode === "PER_COURSE" && stats.money.coursesLeftToPay !== null && (
        <div className="sp-cap">
          <div className="sp-cap-top">
            <span className="sp-cap-name">Courses you pay for</span>
            <span className="sp-cap-num">
              <b>{Math.min(stats.money.coursesBilled, cap)}</b> / {cap}
            </span>
          </div>
          <div
            className="sp-bar"
            role="progressbar"
            aria-label="Paid courses used"
            aria-valuenow={Math.round(capPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span data-level={capPct >= 100 ? "high" : "mid"} style={{ width: `${capPct}%` }} />
          </div>
          <span className="sp-hint">
            {stats.money.coursesLeftToPay === 0
              ? "Cap reached. Every remaining course is free."
              : `${stats.money.coursesLeftToPay} paid ${
                  stats.money.coursesLeftToPay === 1 ? "course" : "courses"
                } left, then the rest of the degree is free.`}
            {stats.money.coursesFree > 0 && ` ${stats.money.coursesFree} free so far.`}
          </span>
        </div>
      )}

      {stats.moneyByTerm.length > 1 && (
        <div className="sp-money-terms">
          {stats.moneyByTerm.map((t) => {
            const total = t.paid + t.due;
            const height = `${Math.max(4, (Math.abs(total) / termMax) * 100)}%`;
            return (
              <div className="sp-money-term" key={t.key}>
                <span className="sp-money-term-amt">{formatMoney(total, currency)}</span>
                <div className="sp-money-term-stack">
                  {t.due !== 0 && <i className="sp-mt-due" style={{ height }} />}
                  {t.paid !== 0 && (
                    <i className={total < 0 ? "sp-mt-neg" : "sp-mt-paid"} style={{ height }} />
                  )}
                </div>
                <span className="sp-money-term-label">{t.label}</span>
              </div>
            );
          })}
        </div>
      )}

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
