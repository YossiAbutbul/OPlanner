import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import Modal from "./Modal";
import { MAX_EXAM_COLUMNS, MAX_EXAM_ROWS } from "../services/courseMeta";
import "../css/ExamsPanel.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (questions: number, exams: number) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Stepper: − [number] + with min/max clamping. Keeps the setup inputs touch
// friendly and avoids tiny native number spinners.
const Stepper: React.FC<{
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}> = ({ id, value, min, max, onChange }) => (
  <div className="exam-setup-stepper">
    <button
      type="button"
      className="exam-setup-step-btn"
      onClick={() => onChange(clamp(value - 1, min, max))}
      disabled={value <= min}
      aria-label="Decrease"
    >
      <Minus size={15} strokeWidth={2.5} />
    </button>
    <input
      id={id}
      type="number"
      className="exam-setup-step-input"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min, min, max))}
    />
    <button
      type="button"
      className="exam-setup-step-btn"
      onClick={() => onChange(clamp(value + 1, min, max))}
      disabled={value >= max}
      aria-label="Increase"
    >
      <Plus size={15} strokeWidth={2.5} />
    </button>
  </div>
);

const ExamSetupModal: React.FC<Props> = ({ isOpen, onClose, onCreate }) => {
  const [questions, setQuestions] = useState(5);
  const [exams, setExams] = useState(3);

  const create = () => {
    onCreate(
      clamp(questions || 1, 1, MAX_EXAM_COLUMNS),
      clamp(exams || 1, 1, MAX_EXAM_ROWS)
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set up exam tracker"
      footer={
        <>
          <button className="app-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="app-modal-btn-primary" onClick={create}>
            Create table
          </button>
        </>
      }
    >
      <p className="exam-setup-lead">
        Build a grid to track which past-exam questions you've solved. You can
        add or remove rows and columns anytime.
      </p>

      <div className="exam-setup-field">
        <label htmlFor="exam-q">Questions per exam</label>
        <Stepper id="exam-q" value={questions} min={1} max={MAX_EXAM_COLUMNS} onChange={setQuestions} />
      </div>

      <div className="exam-setup-field">
        <label htmlFor="exam-n">Number of exams</label>
        <Stepper id="exam-n" value={exams} min={1} max={MAX_EXAM_ROWS} onChange={setExams} />
      </div>

      <p className="exam-setup-preview">
        Creates a {exams} × {questions} grid ({exams} {exams === 1 ? "exam" : "exams"},{" "}
        {questions} {questions === 1 ? "question" : "questions"} each).
      </p>
    </Modal>
  );
};

export default ExamSetupModal;
