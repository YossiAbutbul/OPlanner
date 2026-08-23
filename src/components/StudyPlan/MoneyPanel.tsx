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

  const denom = Math.max(1, total);
  const pct = (value: number) => `${Math.max(0, (value / denom) * 100)}%`;
  const ordered = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="sp-block">
      <header className="sp-block-head">
        <h2>Money</h2>
        <button type="button" className="sp-link-btn" onClick={onConfigure}>
          Tuition settings
        </button>
      </header>

      {!priced && payments.length === 0 ? (
        <>
          <p className="sp-block-note">
            Add what a credit or a course costs and the degree total, what is left, and the
            paid-course cap all fill in.
          </p>
          <div className="sp-actions">
            <button type="button" className="sp-btn sp-btn-primary" onClick={onConfigure}>
              Set tuition
            </button>
            <button type="button" className="sp-btn" onClick={onAdd}>
              Add a payment
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sp-money-figures">
            <div className="sp-money-figure">
              <span className="sp-money-num">{formatMoney(spent, currency)}</span>
              <span className="sp-money-cap">paid so far</span>
            </div>
            <div className="sp-money-figure">
              <span className="sp-money-num">{formatMoney(due + projected, currency)}</span>
              <span className="sp-money-cap">still to pay</span>
            </div>
          </div>

          <div className="sp-money-bar" aria-hidden="true">
            <i className="sp-seg-paid" style={{ width: pct(Math.max(0, spent)) }} />
            <i className="sp-seg-due" style={{ width: pct(Math.max(0, due)) }} />
            <i className="sp-seg-future" style={{ width: pct(projected) }} />
          </div>
          <ul className="sp-key">
            <li>
              <i className="sp-sw sp-sw-done" />
              paid
            </li>
            <li>
              <i className="sp-sw sp-sw-active" />
              billed {formatMoney(due, currency)}
            </li>
            <li>
              <i className="sp-sw sp-sw-left" />
              projected {formatMoney(projected, currency)}
            </li>
          </ul>

          {perCourse && stats.money.coursesLeftToPay !== null && (
            <div className="sp-cap">
              <div className="sp-cap-line">
                <span className="sp-cap-name">Paid courses used</span>
                <span className="sp-cap-num">
                  <b>{Math.min(stats.money.coursesBilled, cap)}</b> / {cap}
                </span>
              </div>
              <div
                className="sp-cap-bar"
                role="progressbar"
                aria-label="Paid courses used"
                aria-valuenow={Math.round(capPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${capPct}%` }} />
              </div>
              <span className="sp-dim">
                {stats.money.coursesLeftToPay === 0
                  ? `Cap reached — every remaining course is free (${stats.money.coursesFree} so far).`
                  : `${stats.money.coursesLeftToPay} paid courses left, then the rest is free.`}
              </span>
            </div>
          )}

          {ordered.length > 0 && (
            <ul className="sp-ledger">
              {ordered.slice(0, 5).map((p) => (
                <li className="sp-led-row" key={p.id}>
                  <span className="sp-led-when">{formatDate(p.date)}</span>
                  <span className="sp-led-what">
                    {p.note?.trim() || KIND_LABEL[p.kind]}
                    {p.semester ? ` · ${p.semester.replace("Semester ", "Sem ")}` : ""}
                  </span>
                  <span
                    className={`sp-led-amt ${p.amount < 0 ? "sp-neg" : p.paid ? "" : "sp-due"}`}
                  >
                    {formatMoney(p.amount, currency)}
                  </span>
                  <span className="sp-led-actions">
                    <button type="button" onClick={() => onEdit(p)} aria-label="Edit payment">
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="sp-danger"
                      onClick={() => onDelete(p)}
                      aria-label="Delete payment"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="sp-btn" onClick={onAdd}>
            <Plus size={16} />
            Add payment
          </button>
        </>
      )}
    </section>
  );
};

export default MoneyPanel;
