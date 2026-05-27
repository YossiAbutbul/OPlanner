import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";

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
    ignoreOverdue?: boolean,
    startTime?: string,
    endTime?: string
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
    startTime?: string;
    endTime?: string;
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
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name);
      setDueDate(editHomework.dueDate);
      setStatus(editHomework.status);
      setIgnoreOverdue(!!editHomework.ignoreOverdue);
      setCourseChoice(editHomework.course || REMINDERS_COURSE);
      const initStart = editHomework.startTime || "";
      const initEnd = editHomework.endTime || "";
      // Legacy entries (no times) are also treated as all-day to match calendar rendering.
      const isAll =
        (initStart === "00:00" && initEnd === "23:59") ||
        (initStart === "07:00" && initEnd === "23:00") ||
        (!initStart && !initEnd);
      setAllDay(isAll);
      setStartTime(isAll ? "07:00" : initStart);
      setEndTime(isAll ? "23:00" : initEnd);
    } else {
      const now = new Date();
      const curStart = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
      const total = parseInt(curStart.slice(0, 2)) * 60 + parseInt(curStart.slice(3));
      const endTotal = total + 30;
      const curEnd = `${String(Math.min(23, Math.floor(endTotal / 60))).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
      setName("");
      setDueDate(prefilledDueDate || "");
      setStatus("PENDING");
      setIgnoreOverdue(false);
      setCourseChoice(REMINDERS_COURSE);
      setStartTime(curStart);
      setEndTime(curEnd);
      setAllDay(false);
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
      ignoreOverdue,
      allDay ? "07:00" : (startTime || undefined),
      allDay ? "23:00" : (endTime || undefined)
    );
    setName("");
    setDueDate("");
    setStatus("PENDING");
    setIgnoreOverdue(false);
    setStartTime("");
    setEndTime("");
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
      <div className="hw-time-row">
        <div className="hw-time-col">
          <TimePicker
            label="Start with"
            value={startTime}
            onChange={(v) => {
              setStartTime(v);
              // Auto-set end = start + 30min if empty or <= start.
              if (v && (!endTime || endTime <= v)) {
                const [h, m] = v.split(":").map(Number);
                const total = h * 60 + m + 30;
                const eh = Math.min(23, Math.floor(total / 60));
                const em = total % 60;
                setEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
              }
            }}
            placeholder="--:--"
            disabled={allDay}
          />
        </div>
        <div className="hw-time-col">
          <TimePicker
            label="End with"
            value={endTime}
            onChange={setEndTime}
            placeholder="--:--"
            minTime={startTime || undefined}
            disabled={allDay}
          />
        </div>
      </div>
      <label className="tb-allday">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => {
            const on = e.target.checked;
            setAllDay(on);
            if (on) {
              setStartTime("07:00");
              setEndTime("23:00");
            } else {
              const now = new Date();
              const cs = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
              const total = parseInt(cs.slice(0, 2)) * 60 + parseInt(cs.slice(3)) + 30;
              const ce = `${String(Math.min(23, Math.floor(total / 60))).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
              setStartTime(cs);
              setEndTime(ce);
            }
          }}
        />
        <span>All day</span>
      </label>
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
