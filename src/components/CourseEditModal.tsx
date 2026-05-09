import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import ColorPicker from "./ColorPicker";
import "../css/TabSettingsModal.css";

interface Props {
  isOpen: boolean;
  currentName: string;
  /** Effective current color — pass the persisted color or the auto-generated fallback. */
  currentColor: string;
  /** Whether the persisted color is set (controls Clear-button enabled state). */
  hasExplicitColor: boolean;
  onClose: () => void;
  onSave: (name: string, color: string | null) => Promise<void> | void;
}

const capitalizeWords = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const CourseEditModal: React.FC<Props> = ({
  isOpen,
  currentName,
  currentColor,
  hasExplicitColor,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentName);
  const [color, setColor] = useState<string | null>(
    hasExplicitColor ? currentColor : null
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(capitalizeWords(currentName));
      setColor(hasExplicitColor ? currentColor : null);
      setBusy(false);
    }
  }, [isOpen, currentName, currentColor, hasExplicitColor]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave(capitalizeWords(name.trim()), color);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const effectiveColor = color || currentColor;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Edit course"
      footer={
        <>
          <button
            type="button"
            className="app-modal-btn-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={handleSave}
            disabled={busy || !name.trim()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <label htmlFor="course-edit-name">Name</label>
      <input
        id="course-edit-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
        autoFocus
        disabled={busy}
      />

      <label style={{ marginTop: "0.85rem" }}>Color</label>
      <ColorPicker
        value={effectiveColor || null}
        onChange={setColor}
        disabled={busy}
      />
    </Modal>
  );
};

export default CourseEditModal;
