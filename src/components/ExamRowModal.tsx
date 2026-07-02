import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { MAX_EXAM_LABEL_LEN } from "../services/courseMeta";
import "../css/ExamsPanel.css";

interface Props {
  isOpen: boolean;
  initialName: string;
  initialUrl: string;
  initialSolutionUrl: string;
  onSave: (name: string, url: string, solutionUrl: string) => void;
  onClose: () => void;
}

// Prepend https:// when the user typed a bare domain, so the link is clickable.
const normalizeUrl = (raw: string): string => {
  const s = raw.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

const ExamRowModal: React.FC<Props> = ({
  isOpen,
  initialName,
  initialUrl,
  initialSolutionUrl,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [solutionUrl, setSolutionUrl] = useState(initialSolutionUrl);

  // Re-seed the fields each time the modal opens for a (possibly different) row.
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setUrl(initialUrl);
      setSolutionUrl(initialSolutionUrl);
    }
  }, [isOpen, initialName, initialUrl, initialSolutionUrl]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, normalizeUrl(url), normalizeUrl(solutionUrl));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit exam"
      footer={
        <>
          <button className="app-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="app-modal-btn-primary" onClick={save} disabled={!name.trim()}>
            Save
          </button>
        </>
      }
    >
      <label className="exam-row-field">
        <span>Exam name</span>
        <input
          type="text"
          autoFocus
          maxLength={MAX_EXAM_LABEL_LEN}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="e.g. 2022b Moed A"
        />
      </label>

      <label className="exam-row-field">
        <span>Exam link <em>(optional)</em></span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="https://…"
        />
      </label>

      <label className="exam-row-field">
        <span>Solution link <em>(optional)</em></span>
        <input
          type="url"
          value={solutionUrl}
          onChange={(e) => setSolutionUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="https://…"
        />
      </label>
    </Modal>
  );
};

export default ExamRowModal;
