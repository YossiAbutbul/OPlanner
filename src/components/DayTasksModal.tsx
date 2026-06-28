import React from "react";
import { ListPlus } from "lucide-react";
import Modal from "./Modal";
import { HomeworkEntry } from "../context/HomeworkContext";
import "../css/DayTasksModal.css";

interface Props {
  isOpen: boolean;
  date: string;
  tasks: HomeworkEntry[];
  onClose: () => void;
  onEdit: (t: HomeworkEntry) => void;
  onDelete: (t: HomeworkEntry) => void;
  onAdd: () => void;
  showCourse?: boolean;
}

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const courseLabel = (c: string) =>
  c === "reminders" ? "Reminder" : c;

const DayTasksModal: React.FC<Props> = ({
  isOpen,
  date,
  tasks,
  onClose,
  onEdit,
  onDelete,
  onAdd,
  showCourse,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tasks · ${fmtDate(date)}`}
      footer={
        <>
          <button className="app-modal-btn-cancel" onClick={onClose}>
            Close
          </button>
          <button className="app-modal-btn-primary" onClick={onAdd}>
            <ListPlus size={16} />
            New task
          </button>
        </>
      }
    >
      {tasks.length === 0 ? (
        <p className="day-empty">No tasks on this day.</p>
      ) : (
        (() => {
          const now = new Date();
          const todayIso = toIso(now);
          const nowHHmm = `${String(now.getHours()).padStart(2, "0")}:${String(
            now.getMinutes()
          ).padStart(2, "0")}`;
          // Overdue: incomplete and its deadline has passed. Past days are always
          // overdue; today's tasks only once their end time (if any) is behind us.
          const isOverdue = (t: HomeworkEntry) =>
            t.dueDate < todayIso ||
            (t.dueDate === todayIso && !!t.endTime && t.endTime < nowHHmm);
          const pending = tasks.filter((t) => t.status !== "COMPLETED");
          const overdue = pending.filter(isOverdue);
          const todo = pending.filter((t) => !isOverdue(t));
          const done = tasks.filter((t) => t.status === "COMPLETED");

          const renderItem = (t: HomeworkEntry) => (
            <li
              key={t.id}
              className={`day-task${t.status === "COMPLETED" ? " is-done" : ""}`}
            >
              <div className={`day-task-main${showCourse && t.course ? " has-course" : ""}`}>
                <div className="day-task-name">{t.name}</div>
                {showCourse && t.course && (
                  <div className="day-task-course">{courseLabel(t.course)}</div>
                )}
              </div>
              <div className="day-task-actions">
                <button className="day-btn" onClick={() => onEdit(t)}>Edit</button>
                <button className="day-btn danger" onClick={() => onDelete(t)}>Delete</button>
              </div>
            </li>
          );

          // Headers stay LTR (English labels); only the rows flip per their
          // own dir when the task text is Hebrew.
          const renderSection = (
            label: string,
            list: HomeworkEntry[],
            headClass = ""
          ) =>
            list.length > 0 && (
              <section className="day-section">
                <h4 className={`day-section-head ${headClass}`}>
                  {label} <span>{list.length}</span>
                </h4>
                <ul className="day-tasks">{list.map(renderItem)}</ul>
              </section>
            );

          return (
            <div className="day-scroll">
              {renderSection("Overdue", overdue, "day-section-overdue")}
              {renderSection("To do", todo)}
              {renderSection("Done", done, "day-section-done")}
            </div>
          );
        })()
      )}
    </Modal>
  );
};

export default DayTasksModal;
