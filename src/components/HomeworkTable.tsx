import React, { Suspense, lazy, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useToast } from "../context/ToastContext";
import DeleteModal from "./DeleteModal";
import "../css/HomeworkTable.css";
import { Pencil, Trash2, Check, Clock, AlertCircle } from "lucide-react";
import { isOverdue, timeLeft } from "../utility/dayCalendar";
import type { HomeworkEntry } from "../types/models";

// Lazy so HomeworkModal stays in its own chunk (would be cancelled by a
// static import here — see vite "INEFFECTIVE_DYNAMIC_IMPORT" warning).
const HomeworkModal = lazy(() => import("./HomeworkModal"));

interface HomeworkTableProps {
  tasks: HomeworkEntry[]; // Accept tasks from parent
  onAddTask: () => void; // Trigger modal for adding homework
  loading?: boolean; // Fetching from network with no cached rows to show
}

const HomeworkTable: React.FC<HomeworkTableProps> = ({ tasks, onAddTask, loading }) => {
  const { removeHomework, addHomework } = useHomework();
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editHomework, setEditHomework] = useState<HomeworkEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HomeworkEntry | null>(null);

  // Handle task deletion
  const handleDelete = (homework: HomeworkEntry) => {
    setConfirmDelete(homework);
  };

  const confirmDeleteTask = async () => {
    if (confirmDelete) {
      const { id, year, semester, course } = confirmDelete;
      try {
        await removeHomework(id, year, semester, course);
      } catch (error) {
        console.error("Error deleting homework:", error);
      } finally {
        setConfirmDelete(null);
      }
    }
  };

  // Handle task editing
  const handleEditClick = (homework: HomeworkEntry) => {
    setEditHomework(homework); // Set the homework for editing
    setModalOpen(true);
  };

  // Capitalize the first letter of the homework name
  const capitalizeFirstLetter = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const statusLabel = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  // Sort: non-completed first (by due date asc), completed at bottom (by due date asc)
  const sortedHomework = [...tasks].sort((a, b) => {
    const aDone = a.status === "COMPLETED";
    const bDone = b.status === "COMPLETED";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const openCount = sortedHomework.filter((t) => t.status !== "COMPLETED").length;

  // One list row: status glyph, name over date, time-left pill, actions.
  const renderRow = (entry: HomeworkEntry) => {
    const done = entry.status === "COMPLETED";
    const time = entry.endTime ?? entry.startTime;
    const overdue = !done && !entry.ignoreOverdue && isOverdue(entry.dueDate, time);
    const tone = done ? "done" : overdue ? "overdue" : "open";
    const left = done ? null : timeLeft(entry.dueDate, time);
    const urgency = !left ? "" : left.days <= 1 ? "soon" : left.days <= 3 ? "near" : "far";
    const d = new Date(entry.dueDate + "T00:00:00");
    const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const label = overdue ? "Overdue" : statusLabel(entry.status);
    return (
      <li key={`${entry.id}-${entry.dueDate}`} className={`hw-row hw-row-${tone}`}>
        <span className={`hw-glyph hw-glyph-${tone}`} title={label} aria-label={label}>
          {done ? <Check size={14} strokeWidth={2.6} /> : overdue ? <AlertCircle size={14} strokeWidth={2.4} /> : <Clock size={14} strokeWidth={2.4} />}
        </span>
        <button type="button" className="hw-main" onClick={() => handleEditClick(entry)} title="Edit">
          <span className="hw-name" dir="auto">{capitalizeFirstLetter(entry.name)}</span>
          <span className="hw-meta">{time ? `${date} · ${time}` : date}</span>
        </button>
        <div className="row-actions">
          <button
            className="row-btn"
            onClick={() => handleEditClick(entry)}
            aria-label="Edit"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            className="row-btn danger"
            onClick={() => handleDelete(entry)}
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
        {left && (
          <span className={`hw-when hw-when-${overdue ? "overdue" : urgency}`}>
            {overdue ? "Overdue" : left.short}
          </span>
        )}
      </li>
    );
  };

  void onAddTask;
  return (
    <div className="homework-table-wrap">
      {loading && sortedHomework.length === 0 ? (
        <div className="homework-skeleton" aria-busy="true" aria-label="Loading tasks">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="hw-skel-row" key={i}>
              <span className="hw-skel-bar hw-skel-glyph" />
              <span className="hw-skel-text">
                <span className="hw-skel-bar hw-skel-name" />
                <span className="hw-skel-bar hw-skel-date" />
              </span>
              <span className="hw-skel-bar hw-skel-status" />
            </div>
          ))}
        </div>
      ) : sortedHomework.length === 0 ? (
        <p className="homework-empty">No tasks yet. Click "New task" above to get started.</p>
      ) : (
        <div className="homework-table-scroll">
          <ul className="hw-list">
            {sortedHomework.slice(0, openCount).map(renderRow)}
            {openCount > 0 && openCount < sortedHomework.length && (
              <li className="hw-group" aria-hidden="true">
                Completed · {sortedHomework.length - openCount}
              </li>
            )}
            {sortedHomework.slice(openCount).map(renderRow)}
          </ul>
        </div>
      )}
      {confirmDelete && (
        <DeleteModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={confirmDeleteTask}
          title="Confirm Delete"
          message={`Are you sure you want to delete this homework: "${confirmDelete.name}"?`}
        />
      )}
      {isModalOpen && (
        <Suspense fallback={null}>
          <HomeworkModal
            isOpen={isModalOpen}
            onClose={() => {
              setModalOpen(false);
              setEditHomework(null);
            }}
            onSave={(id, name, dueDate, status, year, semester, course, ignoreOverdue, startTime, endTime, notes, color) => {
              if (!name || !dueDate) {
                toast.error("Name and due date are required.");
                return;
              }
              addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue, undefined, startTime, endTime, notes, color);
              toast.success(id ? `Task “${name}” updated` : `Task “${name}” added`);
              setModalOpen(false);
              setEditHomework(null);
            }}
            editHomework={editHomework}
            selectedCourseData={null}
            isLoading={false}
          />
        </Suspense>
      )}
    </div>
  );
};

export default HomeworkTable;
