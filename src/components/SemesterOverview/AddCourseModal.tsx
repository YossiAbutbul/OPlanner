import React, { useState } from "react";
import Modal from "../Modal";
import { capitalizeWords } from "../../utility/dayCalendar";
import { isCoarsePointer } from "../../utility/pointer";
import { addCourse } from "../../utility/initializeDatabase";

interface Props {
  isOpen: boolean;
  year: number;
  semesterKey: string;
  onClose: () => void;
  onAdded: (courseName: string) => void;
  onError: (msg: string) => void;
}

const AddCourseModal: React.FC<Props> = ({
  isOpen,
  year,
  semesterKey,
  onClose,
  onAdded,
  onError,
}) => {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const close = () => {
    if (adding) return;
    setName("");
    onClose();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const finalName = capitalizeWords(trimmed);
      await addCourse(year, semesterKey, finalName);
      setName("");
      onAdded(finalName);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to add course.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add course"
      footer={
        <>
          <button className="app-modal-btn-cancel" onClick={close} disabled={adding}>
            Cancel
          </button>
          <button
            className="app-modal-btn-primary"
            onClick={submit}
            disabled={adding || !name.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <input
        autoFocus={!isCoarsePointer()}
        type="text"
        value={name}
        placeholder="Course name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={adding}
      />
    </Modal>
  );
};

export default AddCourseModal;
