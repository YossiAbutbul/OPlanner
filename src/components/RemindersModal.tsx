import React from "react";
import { BellPlus } from "lucide-react";
import Modal from "./Modal";
import type { HomeworkEntry } from "../types/models";
import { fmtDate, isOverdue } from "../utility/dayCalendar";
import "../css/RemindersModal.css";

interface Props {
  isOpen: boolean;
  reminders: HomeworkEntry[];
  onClose: () => void;
  onEdit: (t: HomeworkEntry) => void;
  onDelete: (t: HomeworkEntry) => void;
  onAdd: () => void;
}

const timeRange = (t: HomeworkEntry) =>
  t.startTime ? (t.endTime ? `${t.startTime}–${t.endTime}` : t.startTime) : "";

/** Plain-text preview of a reminder's HTML notes. */
const notesPreview = (html?: string) =>
  html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

const RemindersModal: React.FC<Props> = ({
  isOpen,
  reminders,
  onClose,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const sorted = [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const pending = sorted.filter((t) => t.status !== "COMPLETED");
  const overdue = pending.filter((t) => isOverdue(t.dueDate, t.endTime ?? t.startTime));
  const upcoming = pending.filter((t) => !isOverdue(t.dueDate, t.endTime ?? t.startTime));
  const done = sorted.filter((t) => t.status === "COMPLETED");

  const renderItem = (t: HomeworkEntry) => {
    const preview = notesPreview(t.notes);
    return (
      <li key={t.id} className={`rm-item${t.status === "COMPLETED" ? " is-done" : ""}`}>
        <span className="rm-dot" style={{ background: t.color || "#7c4dff" }} />
        <div className="rm-main">
          <div className="rm-name">{t.name}</div>
          <div className="rm-meta">
            <span>{fmtDate(t.dueDate)}</span>
            {timeRange(t) && <span className="rm-time">{timeRange(t)}</span>}
          </div>
          {preview && <div className="rm-notes">{preview}</div>}
        </div>
        <div className="rm-actions">
          <button className="rm-btn" onClick={() => onEdit(t)}>Edit</button>
          <button className="rm-btn danger" onClick={() => onDelete(t)}>Delete</button>
        </div>
      </li>
    );
  };

  const section = (label: string, list: HomeworkEntry[], headClass = "") =>
    list.length > 0 && (
      <section className="rm-section">
        <h4 className={`rm-head ${headClass}`}>
          {label} <span>{list.length}</span>
        </h4>
        <ul className="rm-list">{list.map(renderItem)}</ul>
      </section>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reminders"
      footer={
        <>
          <button className="app-modal-btn-cancel" onClick={onClose}>
            Close
          </button>
          <button className="app-modal-btn-primary" onClick={onAdd}>
            <BellPlus size={16} />
            New reminder
          </button>
        </>
      }
    >
      {reminders.length === 0 ? (
        <p className="rm-empty">No reminders yet. Create one to get notified.</p>
      ) : (
        <div className="rm-scroll">
          {section("Overdue", overdue, "rm-head-overdue")}
          {section("Upcoming", upcoming)}
          {section("Done", done, "rm-head-done")}
        </div>
      )}
    </Modal>
  );
};

export default RemindersModal;
