import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import '../css/HomeworkModal.css'

Modal.setAppElement("#root");

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, name: string, dueDate: string, status: string) => void;
  editHomework?: { id: string; name: string; dueDate: string; status: string } | null;
}

const HomeworkModal: React.FC<HomeworkModalProps> = ({ isOpen, onClose, onSave, editHomework }) => {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");

  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name || "");
      setDueDate(editHomework.dueDate || "");
      setStatus(editHomework.status || "PENDING");
    } else {
      setName("");
      setDueDate("");
      setStatus("PENDING");
    }
  }, [editHomework]);

  const handleSave = () => {
    if (name && dueDate && status) {
      onSave(editHomework?.id || null, name, dueDate, status);
      setName("");
      setDueDate("");
      setStatus("PENDING");
      onClose();
    } else {
      alert("Please fill in all fields!");
    }
  };


  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} contentLabel="Add/Edit Homework">
      <h2>{editHomework ? "Edit Homework" : "Add Homework"}</h2>
      <form>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Due Date:</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">PENDING</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </Modal>
  );
};

export default HomeworkModal;
