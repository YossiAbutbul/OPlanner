import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import '../css/HomeworkTable.css'

const HomeworkTable: React.FC = () => {
  const { homework, addHomework, removeHomework } = useHomework();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editHomework, setEditHomework] = useState<{
    id: string;
    name: string;
    dueDate: string;
    status: string;
  } | null>(null);

  const handleAddOrUpdateHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    console.log("Adding or Updating Homework:", { id, name, dueDate, status }); // Debugging log
    await addHomework(id, name, dueDate, status); // Handles both add and update
    setModalOpen(false);
  };


  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this homework?");
    if (confirmDelete) {
      await removeHomework(id);
    }
  };

  const handleEditClick = (homework: { id: string; name: string; dueDate: string; status: string }) => {
    setEditHomework(homework); // Pass the homework item for editing
    setModalOpen(true);
  };

  return (
    <div>
      <h2>Homework List</h2>
      {homework.length === 0 ? (
        <p>No homework available. Click "Add Homework" to get started!</p>
      ) : (
        <table className="homework-table">
          <thead>
            <tr>
              <th>H.W.</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {homework.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.name}</td>
                <td>{entry.dueDate}</td>
                <td>{entry.status}</td>
                <td>
                  <button onClick={() => handleEditClick(entry)}>Edit</button>
                  <button onClick={() => handleDelete(entry.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      )}
      <button
        className="add-homework-btn"
        onClick={() => {
          setEditHomework(null); // Clear editHomework for new entries
          setModalOpen(true);
        }}
      >
        Add Homework
      </button>
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
