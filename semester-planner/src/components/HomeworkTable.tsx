import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";

const HomeworkTable: React.FC = () => {
  const { homework, addHomework, removeHomework, updateHomework } = useHomework();
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
    if (id) {
      await updateHomework(id, name, dueDate, status); // Update existing homework
    } else {
      await addHomework(name, dueDate, status); // Add new homework
    }
    setModalOpen(false); // Close the modal after saving
  };

  const handleDelete = (id: string) => {
    console.log("Attempting to delete homework with ID:", id); // Debugging log
    removeHomework(id);
  };

  const handleEditClick = (homework: { id: string; name: string; dueDate: string; status: string }) => {
    setEditHomework(homework); // Set the homework to be edited
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
          setEditHomework(null); // Clear editHomework to add new
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
