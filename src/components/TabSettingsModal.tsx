import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import ColorPicker from "./ColorPicker";
import "../css/TabSettingsModal.css";

interface Props {
  isOpen: boolean;
  title: string;
  label: string;
  currentColor?: string;
  onClose: () => void;
  onSave: (color: string | null) => Promise<void> | void;
}

const TabSettingsModal: React.FC<Props> = ({
  isOpen,
  title,
  label,
  currentColor,
  onClose,
  onSave,
}) => {
  const [color, setColor] = useState<string | null>(currentColor ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setColor(currentColor ?? null);
      setBusy(false);
    }
  }, [isOpen, currentColor]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(color);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
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
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="tab-settings-stack">
        <div className="tab-settings-name">
          <span className="tab-settings-label">Name</span>
          <span className="tab-settings-value">{label}</span>
        </div>
        <div className="tab-settings-color">
          <span className="tab-settings-label">Color</span>
          <ColorPicker value={color} onChange={setColor} disabled={busy} />
        </div>
      </div>
    </Modal>
  );
};

export default TabSettingsModal;
