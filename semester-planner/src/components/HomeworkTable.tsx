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
  await addHomework(id, name, dueDate, status); // Updates state
  console.log("Homework added or updated:", { id, name, dueDate, status }); // Debugging log
  setModalOpen(false);
};


  const handleDelete = async (id: string) => {
  const confirmDelete = window.confirm("Are you sure you want to delete this homework?");
  if (confirmDelete) {
    await removeHomework(id); // Pass the correct id
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
            {homework.map((entry) => {
              if (!entry.id) {
                console.warn("Missing or invalid ID for homework entry:", entry);
              }
              return (
                <tr key={entry.id || Math.random().toString()}>
                  <td>{entry.name}</td>
                  <td>{entry.dueDate}</td>
                  <td>{entry.status}</td>
                  <td>
                    <button onClick={() => handleEditClick(entry)}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
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
