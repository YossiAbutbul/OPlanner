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

const courseLabel = (c: string) =>
  c === "reminders" ? "Reminder" : c;

/** True when the string contains any Hebrew character. */
const hasHebrew = (s?: string) => !!s && /[֐-׿]/.test(s);

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
          const todo = tasks.filter((t) => t.status !== "COMPLETED");
          const done = tasks.filter((t) => t.status === "COMPLETED");

          const renderItem = (t: HomeworkEntry) => (
            <li
              key={t.id}
              dir={hasHebrew(t.name) || hasHebrew(t.course) ? "rtl" : "ltr"}
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

          return (
            <div className="day-scroll">
              {todo.length > 0 && (
                <section className="day-section">
                  <h4 className="day-section-head">To do <span>{todo.length}</span></h4>
                  <ul className="day-tasks">{todo.map(renderItem)}</ul>
                </section>
              )}
              {done.length > 0 && (
                <section className="day-section">
                  <h4 className="day-section-head day-section-done">Done <span>{done.length}</span></h4>
                  <ul className="day-tasks">{done.map(renderItem)}</ul>
                </section>
              )}
            </div>
          );
        })()
      )}
    </Modal>
  );
};

export default DayTasksModal;
