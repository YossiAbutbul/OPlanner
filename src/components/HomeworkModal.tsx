import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import DeleteModal from "./DeleteModal";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import NotesEditor from "./NotesEditor";
import CustomSelect from "./CustomSelect";
import { celebrateTaskDone } from "../utility/celebrate";
import { useCourseMeta } from "../hooks/useCourseMeta";

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
    endTime?: string,
    notes?: string,
    color?: string
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
    notes?: string;
    color?: string;
  } | null;
  selectedCourseData: {
    year: number;
    semester: string;
    course?: string;
  } | null;
  prefilledDueDate?: string | null;
  prefilledStartTime?: string | null;
  prefilledEndTime?: string | null;
  isLoading: boolean;
  availableCourses?: string[];
  onDelete?: () => void | Promise<void>;
}

const REMINDERS_COURSE = "reminders";

const DEFAULT_COLORS = [
  "#7c4dff", "#5e35b1", "#3949ab", "#1e88e5", "#42a5f5", "#039be5",
  "#00acc1", "#26a69a", "#43a047", "#66bb6a", "#9ccc65", "#c0ca33",
  "#ffb300", "#fb8c00", "#f4511e", "#ef5350", "#e53935", "#d81b60",
  "#ec407a", "#ab47bc", "#8d6e63", "#78909c", "#546e7a", "#37474f",
];

const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editHomework,
  selectedCourseData,
  prefilledDueDate,
  prefilledStartTime,
  prefilledEndTime,
  isLoading,
  availableCourses,
  onDelete,
}) => {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [courseChoice, setCourseChoice] = useState(REMINDERS_COURSE);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (editHomework) {
      setName(editHomework.name);
      setDueDate(editHomework.dueDate);
      setStatus(editHomework.status);
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
      setNotes(editHomework.notes || "");
      setColor(editHomework.color || "");
    } else {
      const now = new Date();
      const curStart = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
      const total = parseInt(curStart.slice(0, 2)) * 60 + parseInt(curStart.slice(3));
      const endTotal = total + 30;
      const curEnd = `${String(Math.min(23, Math.floor(endTotal / 60))).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
      setName("");
      setDueDate(prefilledDueDate || "");
      setStatus("PENDING");
      // Pre-select active course if provided, else fall back to reminders.
      setCourseChoice(selectedCourseData?.course || REMINDERS_COURSE);
      setStartTime(prefilledStartTime || curStart);
      setEndTime(prefilledEndTime || curEnd);
      setAllDay(false);
      setNotes("");
      setColor("");
    }
  }, [editHomework, prefilledDueDate, prefilledStartTime, prefilledEndTime, isOpen]);

  const handleSave = () => {
    const courseData = editHomework || selectedCourseData;
    if (!courseData) return;
    const { year, semester } = courseData;
    const course = availableCourses !== undefined ? courseChoice : (courseData.course ?? "");
    if (!name.trim() || !dueDate) return;

    // Fire confetti when this save transitions the task into COMPLETED —
    // either a brand-new task created already-done or an existing task
    // flipped from PENDING. Repeated saves while already COMPLETED don't
    // re-fire. Skipped under prefers-reduced-motion inside celebrate().
    const wasCompleted = editHomework?.status === "COMPLETED";
    if (status === "COMPLETED" && !wasCompleted) {
      celebrateTaskDone();
    }

    onSave(
      editHomework?.id || null,
      name.trim(),
      dueDate,
      status,
      year,
      semester,
      course,
      true, // ignoreOverdue: always true
      allDay ? "07:00" : (startTime || undefined),
      allDay ? "23:00" : (endTime || undefined),
      notes || undefined,
      color || undefined
    );
    setName("");
    setDueDate("");
    setStatus("PENDING");
    setStartTime("");
    setEndTime("");
    onClose();
  };

  // Mirror handleSave into a ref so the Enter-key effect below can call the
  // latest version without re-registering its keydown listener on every
  // render. Effect-bound to avoid mutating refs during render.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const t = e.target as HTMLElement | null;
        if (t) {
          const tag = t.tagName;
          if (
            tag === "TEXTAREA" ||
            t.isContentEditable ||
            (tag === "INPUT" && (t as HTMLInputElement).type === "search") ||
            t.closest(".tp-popover")
          ) {
            return;
          }
        }
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const canSave =
    !!name.trim() && !!dueDate && !!(selectedCourseData || editHomework) && !isLoading;

  // Resolve the task's course so the notes editor can offer its links via "@".
  const courseCtx = editHomework ?? selectedCourseData;
  const activeCourse =
    availableCourses !== undefined ? courseChoice : (courseCtx?.course ?? "");
  const courseTab =
    courseCtx && activeCourse && activeCourse !== REMINDERS_COURSE
      ? { year: courseCtx.year, semester: courseCtx.semester, course: activeCourse }
      : null;
  const { meta: courseMeta } = useCourseMeta(courseTab);

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editHomework ? "Edit Task" : "New Task"}
      footer={
        <>
          {editHomework && onDelete && (
            <button
              type="button"
              className="app-modal-btn-danger"
              style={{ marginRight: "auto" }}
              onClick={() => setConfirmDelete(true)}
              disabled={isLoading}
            >
              Delete
            </button>
          )}
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
      <label>Date</label>
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
            step={15}
            disabled={allDay}
          />
        </div>
        <div className="hw-time-col">
          <TimePicker
            label="End with"
            value={endTime}
            onChange={setEndTime}
            placeholder="--:--"
            step={15}
            showDurationFrom={startTime || undefined}
            minTime={(() => {
              if (!startTime) return undefined;
              const [h, m] = startTime.split(":").map(Number);
              const total = h * 60 + m + 14; // end > start+14 → end ≥ start+15
              const eh = Math.min(23, Math.floor(total / 60));
              const em = total % 60;
              return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
            })()}
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
          <CustomSelect
            id="hw-course"
            value={courseChoice}
            onChange={setCourseChoice}
            options={[
              { value: REMINDERS_COURSE, label: "No course" },
              ...availableCourses.map((c) => ({ value: c, label: c })),
            ]}
          />
        </>
      )}
      <label htmlFor="status">Status</label>
      <CustomSelect
        id="status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "PENDING", label: "Pending" },
          { value: "COMPLETED", label: "Completed" },
        ]}
      />
      <label>Color</label>
      <div className="tb-color-row">
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`tb-color-swatch ${c === color ? "tb-color-swatch-active" : ""}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <label>Notes</label>
      <NotesEditor value={notes} onChange={setNotes} placeholder="Optional" links={courseMeta.links} onSave={() => handleSaveRef.current()} />
    </Modal>
    {editHomework && onDelete && (
      <DeleteModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await onDelete();
          setConfirmDelete(false);
          onClose();
        }}
        title="Delete task"
        message={`Delete “${name || "this task"}”? This can't be undone.`}
      />
    )}
    </>
  );
};

export default HomeworkModal;
