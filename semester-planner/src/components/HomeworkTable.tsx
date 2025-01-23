import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import "../css/HomeworkTable.css";
import "boxicons/css/boxicons.min.css";

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

  // Handle task deletion
  const handleDelete = async (id: string) => {
    const homeworkEntry = tasks.find((task) => task.id === id);

    if (!homeworkEntry) {
      console.error("Homework entry not found for deletion.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete this homework: "${homeworkEntry.name}"?`
    );

    if (confirmDelete) {
      const { year, semester, course } = homeworkEntry;
      try {
        await removeHomework(id, year, semester, course);
        console.log(`Task "${homeworkEntry.name}" deleted successfully.`);
      } catch (error) {
        console.error("Error deleting homework:", error);
      }
    }
  };

  // Handle task editing
  const handleEditClick = (homework: HomeworkEntry) => {
    setEditHomework(homework); // Set the homework for editing
    setModalOpen(true);
  };

  // Get style for status
  const getStatusStyle = (status: string) => {
    return status === "COMPLETED"
      ? { color: "#00bb77", fontWeight: "bold" }
      : { color: "#ffbf00", fontWeight: "bold" };
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  // Sort homework for display
  const sortedHomework = [...tasks].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div>
      <div className="header-row">
        <h2>Tasks List</h2>
        <button className="add-homework-btn" onClick={onAddTask}>
          <i className="bx bx-plus"></i> Add Task
        </button>
      </div>
      {sortedHomework.length === 0 ? (
        <p>No tasks available. Click "Add Task" to get started!</p>
      ) : (
        <table className="homework-table">
          <thead>
            <tr>
              <th>Assignment</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedHomework.map((entry, index) => (
              <tr key={`${entry.id}-${entry.dueDate}`}>
                <td>
                  <i className="bx bx-edit"></i> {entry.name}
                </td>
                <td>
                  <i className="bx bx-calendar-alt"></i> {formatDate(entry.dueDate)}
                </td>
                <td style={getStatusStyle(entry.status)}>{entry.status}</td>
                <td>
                  <button onClick={() => handleEditClick(entry)}>Edit</button>
                  <button onClick={() => handleDelete(entry.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditHomework(null);
        }}
        onSave={(id, name, dueDate, status, year, semester, course) => {
          if (!name || !dueDate) {
            alert("Please fill in all fields before saving.");
            return;
          }
          addHomework(id, name, dueDate, status, year, semester, course);
          setModalOpen(false);
          setEditHomework(null);
        }}
        editHomework={editHomework}
        selectedCourseData={editHomework ? null : null}
      />
    </div>
  );
};

export default HomeworkTable;
