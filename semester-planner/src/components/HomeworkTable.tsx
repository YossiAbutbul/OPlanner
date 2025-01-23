import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import "../css/HomeworkTable.css";
import "boxicons/css/boxicons.min.css";

const HomeworkTable: React.FC = () => {
  const { homework, addHomework, removeHomework } = useHomework();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editHomework, setEditHomework] = useState<{
    id: string;
    name: string;
    dueDate: string;
    status: string;
  } | null>(null);

  const handleAddOrUpdateHomework = async (id, name, dueDate, status) => {
  if (!selectedYear || !selectedSemester) {
    alert("Please select a year and semester.");
    return;
  }

  try {
    await addHomework(id, name, dueDate, status, selectedYear, selectedSemester);
    alert("Homework added/updated successfully.");
  } catch (error) {
    console.error("Error adding/updating homework:", error);
  }
};


  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this homework?"
    );
    if (confirmDelete) {
      await removeHomework(id); // Pass the correct id
    }
  };

  const handleEditClick = (homework: {
    id: string;
    name: string;
    dueDate: string;
    status: string;
  }) => {
    setEditHomework(homework); // Pass the homework item for editing
    setModalOpen(true);
  };

  const getStatusStyle = (status: string) => {
    return status === "COMPLETED"
      ? { color: "#00bb77", fontWeight: "bold" }
      : { color: "#ffbf00", fontWeight: "bold" };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB"); // Format date as DD/MM/YYYY
  };

  const sortedHomework = [...homework].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div>
      <div className="header-row">
        <h2>Tasks List</h2>
        <button
          className="add-homework-btn"
          onClick={() => {
            setEditHomework(null); // Clear editHomework for new entries
            setModalOpen(true);
          }}
        >
          <i className="bx bx-plus"></i> Add Task
        </button>
      </div>
      {sortedHomework.length === 0 ? (
        <p>No tasks available. Click "Add Homework" to get started!</p>
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
            {sortedHomework.map((entry) => {
              if (!entry.id) {
                console.warn(
                  "Missing or invalid ID for homework entry:",
                  entry
                );
              }
              return (
                <tr key={entry.id || Math.random().toString()}>
                  <td>
                    <i className='bx bx-edit'></i>
                    {entry.name}
                    </td>
                  <td>
                    <i className='bx bx-calendar-alt'></i>
                    {formatDate(entry.dueDate)}
                  </td>
                  <td style={getStatusStyle(entry.status)}>{entry.status}</td>
                  <td>
                    <button onClick={() => handleEditClick(entry)}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleAddOrUpdateHomework}
        editHomework={editHomework}
      />
    </div>
  );
};

export default HomeworkTable;
