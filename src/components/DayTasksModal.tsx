import React from "react";
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
  c === "__reminders__" ? "Reminder" : c;

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
            New task
          </button>
        </>
      }
    >
      {tasks.length === 0 ? (
        <p className="day-empty">No tasks on this day.</p>
      ) : (
        <ul className="day-tasks">
          {tasks.map((t) => (
            <li key={t.id} className="day-task">
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
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default DayTasksModal;
