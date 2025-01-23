import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import "../css/HomeworkModal.css";

Modal.setAppElement("#root");

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => void;
  editHomework?: { id: string; name: string; dueDate: string; status: string } | null;
  selectedCourseData: {
    year: number;
    semester: string;
    course: string;
  } | null;
}

const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editHomework,
  selectedCourseData,
}) => {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const dateInputRef = useRef<HTMLInputElement>(null);

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
    if (!selectedCourseData) {
      alert("Please select a valid course to add homework.");
      console.error("Invalid selectedCourseData:", selectedCourseData);
      return;
    }

    const { year, semester, course } = selectedCourseData;

    if (name && dueDate && status) {
      onSave(editHomework?.id || null, name, dueDate, status, year.toString(), semester, course);
      setName("");
      setDueDate("");
      setStatus("PENDING");
      onClose();
    } else {
      alert("Please fill in all fields!");
    }
  };

  const handleDateClick = () => {
    dateInputRef.current?.showPicker();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isOpen) {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, name, dueDate, status]);

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
          <div
            className="date-input-container"
            onClick={handleDateClick}
            style={{ cursor: "pointer" }}
          >
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              ref={dateInputRef}
              required
            />
          </div>
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
