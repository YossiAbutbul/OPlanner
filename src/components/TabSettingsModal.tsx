import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import "../css/TabSettingsModal.css";

const PRESETS = [
  "#1db954", // green
  "#3498db", // blue
  "#9b59b6", // purple
  "#e67e22", // orange
  "#e74c3c", // red
  "#f1c40f", // yellow
  "#1abc9c", // teal
  "#34495e", // slate
  "#e91e63", // pink
];

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
      <div className="tab-settings-row">
        <span className="tab-settings-label">Name</span>
        <span className="tab-settings-value">{label}</span>
      </div>
      <div className="tab-settings-row">
        <span className="tab-settings-label">Color</span>
        <div className="tab-settings-swatches">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`tab-settings-swatch ${color === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            >
              {color === c && (
                <svg
                  className="tab-settings-check"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path
                    d="M5 13l4 4 10-10"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
          <label
            className={`tab-settings-custom ${
              color && !PRESETS.includes(color) ? "selected" : ""
            }`}
            title="Custom color"
            style={
              color && !PRESETS.includes(color)
                ? { background: color }
                : undefined
            }
          >
            {color && !PRESETS.includes(color) && (
              <svg
                className="tab-settings-check"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M5 13l4 4 10-10"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <input
              type="color"
              className="tab-settings-color-input"
              value={color ?? "#000000"}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="tab-settings-clear"
            onClick={() => setColor(null)}
            disabled={!color}
          >
            Clear
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TabSettingsModal;
