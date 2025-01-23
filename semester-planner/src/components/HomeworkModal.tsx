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
    status: string,
    year: number,
    semester: string,
    course: string
  ) => void;
  editHomework?: {
    id: string;
    name: string;
    dueDate: string;
    status: string;
    year: number;
    semester: string;
    course: string;
  } | null;
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

  // Populate modal fields for editing or reset for adding
  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name);
      setDueDate(editHomework.dueDate);
      setStatus(editHomework.status);
    } else {
      setName("");
      setDueDate("");
      setStatus("PENDING");
    }
  }, [editHomework]);

  const handleSave = () => {
    const courseData = editHomework || selectedCourseData;

    if (!courseData) {
      alert("Please select a valid course to add or edit homework.");
      return;
    }

    const { year, semester, course } = courseData;

    if (!name.trim()) {
      alert("Please enter a valid name for the homework.");
      return;
    }

    if (!dueDate) {
      alert("Please select a valid due date for the homework.");
      return;
    }

    // Call the parent save function
    onSave(editHomework?.id || null, name.trim(), dueDate, status, year, semester, course);

    // Reset modal fields
    setName("");
    setDueDate("");
    setStatus("PENDING");
    onClose();
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
  }, [isOpen, name, dueDate, status, selectedCourseData, editHomework]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={editHomework ? "Edit Homework" : "Add Homework"}
    >
      <h2>{editHomework ? "Edit Homework" : "Add Homework"}</h2>
      <form>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter homework name"
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
            />
          </div>
        </div>
        <div>
          <label>Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="PENDING">PENDING</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || !dueDate || !(selectedCourseData || editHomework)}
        >
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
