import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import DatePicker from "./DatePicker";

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
    course: string,
    ignoreOverdue?: boolean
  ) => void;
  editHomework?: {
    id: string;
    name: string;
    dueDate: string;
    status: string;
    year: number;
    semester: string;
    course: string;
    ignoreOverdue?: boolean;
  } | null;
  selectedCourseData: {
    year: number;
    semester: string;
    course?: string;
  } | null;
  prefilledDueDate?: string | null;
  isLoading: boolean;
  availableCourses?: string[];
}

const REMINDERS_COURSE = "reminders";

const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editHomework,
  selectedCourseData,
  prefilledDueDate,
  isLoading,
  availableCourses,
}) => {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [ignoreOverdue, setIgnoreOverdue] = useState(false);
  const [courseChoice, setCourseChoice] = useState(REMINDERS_COURSE);

  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name);
      setDueDate(editHomework.dueDate);
      setStatus(editHomework.status);
      setIgnoreOverdue(!!editHomework.ignoreOverdue);
      setCourseChoice(editHomework.course || REMINDERS_COURSE);
    } else {
      setName("");
      setDueDate(prefilledDueDate || "");
      setStatus("PENDING");
      setIgnoreOverdue(false);
      setCourseChoice(REMINDERS_COURSE);
    }
  }, [editHomework, prefilledDueDate, isOpen]);

  const handleSave = () => {
    const courseData = editHomework || selectedCourseData;
    if (!courseData) return;
    const { year, semester } = courseData;
    const course = availableCourses !== undefined ? courseChoice : (courseData.course ?? "");
    if (!name.trim() || !dueDate) return;

    onSave(
      editHomework?.id || null,
      name.trim(),
      dueDate,
      status,
      year,
      semester,
      course,
      ignoreOverdue
    );
    setName("");
    setDueDate("");
    setStatus("PENDING");
    setIgnoreOverdue(false);
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
      <label>Due date</label>
      <DatePicker
        value={dueDate || null}
        onChange={(v) => setDueDate(v ?? "")}
        block
      >
        {(open) => {
          let display = "Select date";
          if (dueDate) {
            const [y, m, d] = dueDate.split("-");
            display = `${d}/${m}/${y}`;
          }
          return (
            <button
              type="button"
              className="hw-date-trigger"
              onClick={open}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className={dueDate ? "" : "hw-date-trigger-empty"}>
                {display}
              </span>
            </button>
          );
        }}
      </DatePicker>
      {availableCourses !== undefined && (
        <>
          <label htmlFor="hw-course">Course</label>
          <select
            id="hw-course"
            value={courseChoice}
            onChange={(e) => setCourseChoice(e.target.value)}
          >
            <option value={REMINDERS_COURSE}>No course (reminder)</option>
            {availableCourses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="status">Status</label>
      <select
        id="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="PENDING">Pending</option>
        <option value="COMPLETED">Completed</option>
      </select>
      <label className="hw-ignore-overdue">
        <input
          type="checkbox"
          checked={ignoreOverdue}
          onChange={(e) => setIgnoreOverdue(e.target.checked)}
        />
        <span>Don't flag this task as overdue when past its due date</span>
      </label>
    </Modal>
  );
};

export default HomeworkModal;
