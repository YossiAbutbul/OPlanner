import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";

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
    course?: string;
  } | null;
  prefilledDueDate?: string | null;
  isLoading: boolean;
}

const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editHomework,
  selectedCourseData,
  prefilledDueDate,
  isLoading,
}) => {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name);
      setDueDate(editHomework.dueDate);
      setStatus(editHomework.status);
    } else {
      setName("");
      setDueDate(prefilledDueDate || "");
      setStatus("PENDING");
    }
  }, [editHomework, prefilledDueDate, isOpen]);

  const handleSave = () => {
    const courseData = editHomework || selectedCourseData;
    if (!courseData) return;
    const { year, semester, course = "" } = courseData;
    if (!name.trim() || !dueDate) return;

    onSave(editHomework?.id || null, name.trim(), dueDate, status, year, semester, course);
    setName("");
    setDueDate("");
    setStatus("PENDING");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, name, dueDate, status, selectedCourseData, editHomework]);

  const canSave =
    !!name.trim() && !!dueDate && !!(selectedCourseData || editHomework) && !isLoading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editHomework ? "Edit homework" : "Add homework"}
      footer={
        <>
          <button
            type="button"
            className="app-modal-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isLoading ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <label htmlFor="homework-name">Name</label>
      <input
        id="homework-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter homework name"
        autoComplete="off"
        autoFocus
      />
      <label htmlFor="due-date">Due date</label>
      <input
        id="due-date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        ref={dateInputRef}
      />
      <label htmlFor="status">Status</label>
      <select
        id="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="PENDING">Pending</option>
        <option value="COMPLETED">Completed</option>
      </select>
    </Modal>
  );
};

export default HomeworkModal;
