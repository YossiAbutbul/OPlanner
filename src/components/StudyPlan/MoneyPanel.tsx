import React from "react";
import { Coins, Pencil, Plus, Trash2 } from "lucide-react";
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
  onConfigure: () => void;
}

const KIND_LABEL: Record<PlanPayment["kind"], string> = {
  TUITION: "Tuition",
  FEE: "Fee",
  BOOKS: "Books",
  SCHOLARSHIP: "Scholarship",
  REFUND: "Refund",
  OTHER: "Other",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y.slice(2)}`;
};

const MoneyPanel: React.FC<Props> = ({
  stats,
  config,
  payments,
  onAdd,
  onEdit,
  onDelete,
  onConfigure,
}) => {
  const currency = config.cost.currency;
  const { spent, due, projected, total } = stats.money;
  const perCourse = config.cost.pricingMode === "PER_COURSE";
  const cap = config.cost.paidCoursesCap ?? 0;
  const capPct = cap > 0 ? Math.min(100, (stats.money.coursesBilled / cap) * 100) : 0;

  const priced =
    config.cost.pricePerCredit > 0 ||
    (config.cost.pricePerCourse ?? 0) > 0 ||
    config.cost.perSemesterFee > 0;
  const configured = priced || payments.length > 0;

  const denom = Math.max(1, total);
  const pct = (value: number) => `${Math.max(0, (value / denom) * 100)}%`;
  const ordered = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  if (!configured) {
    return (
      <section className="sp-panel">
        <header className="sp-panel-head">
          <h3>Money</h3>
        </header>
        <div className="sp-blank">
          <Coins size={22} strokeWidth={1.7} />
          <p>
            Add what a credit or a course costs and OPlanner works out what the degree
            has cost you and what is still ahead.
          </p>
          <div className="sp-blank-actions">
            <button type="button" className="sp-btn sp-btn-primary" onClick={onConfigure}>
              Set tuition
            </button>
            <button type="button" className="sp-btn sp-btn-ghost" onClick={onAdd}>
              Add a payment
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="sp-panel">
      <header className="sp-panel-head">
        <h3>Money</h3>
        <span className="sp-hint">{formatMoney(total, currency)} for the degree</span>
      </header>

      <div className="sp-money-top">
        <div className="sp-money-fig">
          <span className="sp-money-value">{formatMoney(spent, currency)}</span>
          <span className="sp-money-label">paid</span>
        </div>
        <div className="sp-money-fig">
          <span className="sp-money-value">{formatMoney(due + projected, currency)}</span>
          <span className="sp-money-label">still to pay</span>
        </div>
      </div>

      <div className="sp-split" aria-hidden="true">
        <i className="sp-split-paid" style={{ width: pct(Math.max(0, spent)) }} />
        <i className="sp-split-due" style={{ width: pct(Math.max(0, due)) }} />
        <i className="sp-split-future" style={{ width: pct(projected) }} />
      </div>
      <div className="sp-legend">
        <span>
          <i className="sp-sw sp-sw-done" />
          paid
        </span>
        <span>
          <i className="sp-sw sp-sw-active" />
          billed {formatMoney(due, currency)}
        </span>
        <span>
          <i className="sp-sw sp-sw-future" />
          projected {formatMoney(projected, currency)}
        </span>
      </div>

      {perCourse && stats.money.coursesLeftToPay !== null && (
        <div className="sp-cap">
          <div className="sp-cap-top">
            <span className="sp-cap-name">Paid courses used</span>
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
            <i className="sp-bar-done" style={{ width: `${capPct}%` }} />
          </div>
          <span className="sp-hint">
            {stats.money.coursesLeftToPay === 0
              ? `Cap reached, every remaining course is free (${stats.money.coursesFree} so far).`
              : `${stats.money.coursesLeftToPay} paid courses left, then the rest is free.`}
          </span>
        </div>
      )}

      {ordered.length > 0 && (
        <div className="sp-ledger">
          {ordered.slice(0, 5).map((p) => (
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
                <button type="button" onClick={() => onEdit(p)} aria-label="Edit payment">
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="sp-danger"
                  onClick={() => onDelete(p)}
                  aria-label="Delete payment"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {ordered.length > 5 && (
            <span className="sp-hint">{ordered.length - 5} older payments not shown</span>
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
