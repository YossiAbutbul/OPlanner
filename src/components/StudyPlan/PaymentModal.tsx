import React, { useEffect, useState } from "react";
import Modal from "../Modal";
import CustomSelect from "../CustomSelect";
import DatePicker from "../DatePicker";
import { CalendarDays } from "lucide-react";
import type { PaymentKind, PlanConfig, PlanPayment } from "../../types/models";

interface Props {
  isOpen: boolean;
  payment: PlanPayment | null; // null = add
  config: PlanConfig;
  onClose: () => void;
  onSave: (payment: PlanPayment) => Promise<void>;
}

const KINDS: { value: PaymentKind; label: string }[] = [
  { value: "TUITION", label: "Tuition" },
  { value: "FEE", label: "Fee" },
  { value: "BOOKS", label: "Books" },
  { value: "SCHOLARSHIP", label: "Scholarship" },
  { value: "REFUND", label: "Refund" },
  { value: "OTHER", label: "Other" },
];

const SEMESTERS = ["Semester A", "Semester B", "Semester C"];

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Scholarships and refunds are stored as negative amounts, so the form takes
// a positive number and flips the sign on save.
const PaymentModal: React.FC<Props> = ({ isOpen, payment, config, onClose, onSave }) => {
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<PaymentKind>("TUITION");
  const [semester, setSemester] = useState("");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDate(payment?.date ?? today());
    setAmount(payment ? String(Math.abs(payment.amount)) : "");
    setKind(payment?.kind ?? "TUITION");
    setSemester(payment?.semester ?? "");
    setNote(payment?.note ?? "");
    setPaid(payment ? payment.paid : true);
    setError(null);
    setSaving(false);
  }, [isOpen, payment]);

  const handleSave = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      setError("Enter an amount.");
      return;
    }
    const signed = kind === "SCHOLARSHIP" || kind === "REFUND" ? -Math.abs(value) : Math.abs(value);

    const next: PlanPayment = {
      id: payment?.id ?? crypto.randomUUID(),
      date,
      amount: signed,
      kind,
      semester: semester || undefined,
      year: Number(date.slice(0, 4)),
      note: note.trim() || undefined,
      paid,
    };

    try {
      setSaving(true);
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payment ? "Edit payment" : "Add payment"}
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="app-modal-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save payment"}
          </button>
        </>
      }
    >
      <div className="sp-form">
        <div className="sp-field-row">
          <div className="sp-field">
            <label>Date</label>
            <DatePicker value={date} onChange={(v) => setDate(v ?? today())} block>
              {(open) => (
                <button type="button" className="sp-date-trigger" onClick={open}>
                  <CalendarDays size={15} />
                  <span>{date}</span>
                </button>
              )}
            </DatePicker>
          </div>
          <div className="sp-field">
            <label htmlFor="sp-amount">
              Amount ({config.cost.currency})
            </label>
            <input
              id="sp-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5900"
            />
          </div>
        </div>

        <div className="sp-field-row">
          <div className="sp-field">
            <label>Kind</label>
            <CustomSelect
              value={kind}
              options={KINDS}
              onChange={(v) => setKind(v as PaymentKind)}
            />
          </div>
          <div className="sp-field">
            <label>Semester</label>
            <CustomSelect
              value={semester}
              options={[
                { value: "", label: "Not tied to a semester" },
                ...SEMESTERS.map((s) => ({ value: s, label: s })),
              ]}
              onChange={setSemester}
            />
          </div>
        </div>

        <div className="sp-field">
          <label htmlFor="sp-note">Note</label>
          <input
            id="sp-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tuition, Semester B"
          />
        </div>

        <div className="sp-checks">
          <label>
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Already paid (unpaid rows count as billed and still due)
          </label>
        </div>

        {kind === "SCHOLARSHIP" || kind === "REFUND" ? (
          <p className="sp-hint">Recorded as a negative amount, so it lowers what the degree cost.</p>
        ) : null}

        {error && <p className="sp-error">{error}</p>}
      </div>
    </Modal>
  );
};

export default PaymentModal;
