import React, { useState, useEffect } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import DeleteModal from "./DeleteModal";
import "../css/HomeworkTable.css";
import "boxicons/css/boxicons.min.css";
import { Pencil, Trash2, Check, Clock } from "lucide-react";

interface HomeworkEntry {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  year: number;
  semester: string;
  course: string;
}

interface HomeworkTableProps {
  tasks: HomeworkEntry[]; // Accept tasks from parent
  onAddTask: () => void; // Trigger modal for adding homework
}

const HomeworkTable: React.FC<HomeworkTableProps> = ({ tasks, onAddTask }) => {
  const { removeHomework, addHomework } = useHomework();
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

  const statusClass = (status: string) =>
    status === "COMPLETED" ? "status-pill status-completed" : "status-pill status-pending";
  const statusLabel = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isMobile) {
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}`;
    }
    return date.toLocaleDateString("en-GB");
  };

  // Sort: non-completed first (by due date asc), completed at bottom (by due date asc)
  const sortedHomework = [...tasks].sort((a, b) => {
    const aDone = a.status === "COMPLETED";
    const bDone = b.status === "COMPLETED";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  void onAddTask;
  return (
    <div className="homework-table-wrap">
      {sortedHomework.length === 0 ? (
        <p className="homework-empty">No tasks yet. Click "Add task" above to get started.</p>
      ) : (
        <>
        {!isMobile && (
        <table className="homework-table homework-table-head">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "170px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Assignment</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
        </table>
        )}
        <div className="homework-table-scroll">
        <table className="homework-table homework-table-body">
          {!isMobile && (
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "170px" }} />
          </colgroup>
          )}
          {isMobile && (
          <thead>
            <tr>
              <th>Task</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          )}
          <tbody>
            {sortedHomework.map((entry) => (
              <tr key={`${entry.id}-${entry.dueDate}`}>
                <td>{capitalizeFirstLetter(entry.name)}</td>
                <td>{formatDate(entry.dueDate)}</td>
                <td>
                  <span className={statusClass(entry.status)} title={statusLabel(entry.status)} aria-label={statusLabel(entry.status)}>
                    {isMobile ? (
                      entry.status === "COMPLETED" ? <Check size={14} /> : <Clock size={14} />
                    ) : (
                      statusLabel(entry.status)
                    )}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="row-btn"
                      onClick={() => handleEditClick(entry)}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil size={14} />
                      <span className="btn-text">Edit</span>
                    </button>
                    <button
                      className="row-btn danger"
                      onClick={() => handleDelete(entry)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                      <span className="btn-text">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
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
      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditHomework(null);
        } }
        onSave={(id, name, dueDate, status, year, semester, course, ignoreOverdue) => {
          if (!name || !dueDate) {
            alert("Please fill in all fields before saving.");
            return;
          }
          addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue);
          setModalOpen(false);
          setEditHomework(null);
        } }
        editHomework={editHomework}
        selectedCourseData={editHomework ? null : null} isLoading={false}      />
    </div>
  );
};

export default HomeworkTable;
