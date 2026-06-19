import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import NotesEditor from "./NotesEditor";
import { TimeBlock } from "../context/TimeBlockContext";
import { isCoarsePointer } from "../utility/pointer";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: TimeBlock) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  initial?: Partial<TimeBlock> | null;
  /** Show course dropdown with these options. */
  availableCourses?: string[];
  /** When dropdown isn't shown, bind block to this course. */
  defaultCourse?: string;
}

const NO_COURSE = "__none__";

const DEFAULT_BLOCK_COLOR = "#7c4dff";

const DEFAULT_COLORS = [
  "#7c4dff", "#5e35b1", "#3949ab", "#1e88e5", "#42a5f5", "#039be5",
  "#00acc1", "#26a69a", "#43a047", "#66bb6a", "#9ccc65", "#c0ca33",
  "#ffb300", "#fb8c00", "#f4511e", "#ef5350", "#e53935", "#d81b60",
  "#ec407a", "#ab47bc", "#8d6e63", "#78909c", "#546e7a", "#37474f",
];

const TimeBlockModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initial,
  availableCourses,
  defaultCourse,
}) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [color, setColor] = useState(DEFAULT_BLOCK_COLOR);
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [courseChoice, setCourseChoice] = useState<string>(NO_COURSE);

  useEffect(() => {
    if (!isOpen) return;
    // Default to current hour floor / +30 min when no initial time provided.
    const now = new Date();
    const curStart = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
    const total = parseInt(curStart.slice(0, 2)) * 60 + parseInt(curStart.slice(3));
    const endTotal = total + 30;
    const curEnd = `${String(Math.min(23, Math.floor(endTotal / 60))).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;

    setTitle(initial?.title ?? "");
    setDate(initial?.date ?? "");
    const initStart = initial?.startTime ?? curStart;
    const initEnd = initial?.endTime ?? curEnd;
    const isAll =
      (initStart === "00:00" && initEnd === "23:59") ||
      (initStart === "07:00" && initEnd === "23:00");
    setAllDay(isAll);
    setStartTime(isAll ? curStart : initStart);
    setEndTime(isAll ? curEnd : initEnd);
    setColor(initial?.color ?? DEFAULT_BLOCK_COLOR);
    setNotes(initial?.notes ?? "");
    setCourseChoice(initial?.courseId ?? defaultCourse ?? NO_COURSE);
  }, [isOpen, initial, defaultCourse]);

  const canSave = !!title.trim() && !!date && (allDay || (!!startTime && !!endTime && startTime < endTime));

  const handleSave = async () => {
    if (!canSave) return;
    const resolvedCourse =
      availableCourses ? courseChoice : (defaultCourse ?? initial?.courseId);
    await onSave({
      id: initial?.id ?? "",
      title: title.trim(),
      date,
      startTime: allDay ? "07:00" : startTime,
      endTime: allDay ? "23:00" : endTime,
      color,
      notes: notes.trim() || undefined,
      courseId: resolvedCourse && resolvedCourse !== NO_COURSE ? resolvedCourse : undefined,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (initial?.id && onDelete) {
      await onDelete(initial.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial?.id ? "Edit time block" : "Add time block"}
      footer={
        <>
          {initial?.id && onDelete && (
            <button type="button" className="app-modal-btn-cancel" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button type="button" className="app-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
        </>
      }
    >
      <label htmlFor="tb-title">Title</label>
      <input
        id="tb-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Study session"
        autoFocus={!isCoarsePointer()}
        autoComplete="off"
      />
      <label>Date</label>
      <DatePicker value={date || null} onChange={(v) => setDate(v ?? "")} block>
        {(open) => {
          let display = "Select date";
          if (date) {
            const [y, m, d] = date.split("-");
            display = `${d}/${m}/${y}`;
          }
          return (
            <button type="button" className="hw-date-trigger" onClick={open}>
              <span className={date ? "" : "hw-date-trigger-empty"}>{display}</span>
            </button>
          );
        }}
      </DatePicker>
      {availableCourses !== undefined && (
        <>
          <label htmlFor="tb-course">Course</label>
          <select
            id="tb-course"
            value={courseChoice}
            onChange={(e) => setCourseChoice(e.target.value)}
          >
            <option value={NO_COURSE}>No course</option>
            {availableCourses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </>
      )}
      <div className="hw-time-row">
        <div className="hw-time-col">
          <TimePicker
            label="Start with"
            value={startTime}
            onChange={(v) => {
              setStartTime(v);
              if (v && (!endTime || endTime <= v)) {
                const [h, m] = v.split(":").map(Number);
                const total = h * 60 + m + 30;
                const eh = Math.min(23, Math.floor(total / 60));
                const em = total % 60;
                setEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
              }
            }}
            step={15}
            disabled={allDay}
          />
        </div>
        <div className="hw-time-col">
          <TimePicker
            label="End with"
            value={endTime}
            onChange={setEndTime}
            disabled={allDay}
            step={15}
            showDurationFrom={startTime || undefined}
            minTime={(() => {
              if (!startTime) return undefined;
              const [h, m] = startTime.split(":").map(Number);
              const total = h * 60 + m + 14;
              const eh = Math.min(23, Math.floor(total / 60));
              const em = total % 60;
              return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
            })()}
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
      <NotesEditor value={notes} onChange={setNotes} placeholder="Optional" />
    </Modal>
  );
};

export default TimeBlockModal;
