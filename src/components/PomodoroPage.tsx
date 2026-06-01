import React, { useEffect, useState } from "react";
import { Play, Pause, Coins, Settings } from "lucide-react";
import { useCoins } from "../context/CoinsContext";
import Modal from "./Modal";
import {
  usePomodoro,
  POMODORO_MODE_LABEL,
  type PomodoroMode,
  type PomodoroDurations,
} from "../context/PomodoroContext";
import "../css/PomodoroPage.css";

const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const ResetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 12a9 9 0 1 0 3-6.7L3 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PomodoroPage: React.FC = () => {
  const { coins } = useCoins();
  const {
    mode,
    secondsLeft,
    running,
    focusDone,
    durations,
    progress,
    toggle,
    reset,
    switchMode,
    setDurations,
  } = usePomodoro();
  const [editing, setEditing] = useState(false);

  return (
    <div className={`pomopage pomopage-mode-${mode}`}>
      <header className="pomopage-header">
        <div className="pomopage-header-title">
          <h1>Focus</h1>
          <span className="pomopage-sub">Pomodoro timer</span>
        </div>
        <div className="pomopage-header-actions">
          <div className="pomopage-coins" title="Coins earned">
            <Coins size={18} />
            {coins}
          </div>
          <button
            className="pomopage-settings-btn"
            onClick={() => setEditing(true)}
            title="Customize durations"
            aria-label="Customize durations"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="pomopage-body">
        <div className="pomopage-modes">
          {(["focus", "short", "long"] as PomodoroMode[]).map((m) => (
            <button
              key={m}
              className={`pomopage-mode-btn ${mode === m ? "active" : ""}`}
              onClick={() => switchMode(m)}
            >
              {POMODORO_MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="pomopage-ring-wrap">
          <svg className="pomopage-ring" viewBox="0 0 300 300" aria-hidden>
            <circle className="pomopage-ring-track" cx="150" cy="150" r={RING_R} />
            <circle
              className="pomopage-ring-fill"
              cx="150"
              cy="150"
              r={RING_R}
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
            />
          </svg>
          <div className="pomopage-ring-center">
            <div className="pomopage-time" role="timer" aria-live="off">
              {fmt(secondsLeft)}
            </div>
            <div className="pomopage-session">
              {mode === "focus"
                ? `Round ${(focusDone % 4) + 1} / 4`
                : POMODORO_MODE_LABEL[mode]}
            </div>
          </div>
        </div>

        <div className="pomopage-controls">
          <button className="pomopage-primary" onClick={toggle}>
            {running ? <Pause size={20} /> : <Play size={20} />}
            <span>{running ? "Pause" : "Start"}</span>
          </button>
          <button className="pomopage-ghost" onClick={reset} title="Reset" aria-label="Reset">
            <ResetIcon />
            <span>Reset</span>
          </button>
        </div>

      </div>

      <DurationEditorModal
        isOpen={editing}
        durations={durations}
        onClose={() => setEditing(false)}
        onSave={(d) => {
          setDurations(d);
          setEditing(false);
        }}
      />
    </div>
  );
};

const DURATION_ROWS: { key: PomodoroMode; label: string }[] = [
  { key: "focus", label: "Focus" },
  { key: "short", label: "Short break" },
  { key: "long", label: "Long break" },
];

const DurationEditorModal: React.FC<{
  isOpen: boolean;
  durations: PomodoroDurations;
  onClose: () => void;
  onSave: (d: PomodoroDurations) => void;
}> = ({ isOpen, durations, onClose, onSave }) => {
  const [draft, setDraft] = useState<PomodoroDurations>(durations);

  // Reset the draft to the live values each time the modal opens so a
  // cancelled edit never leaks into the next session.
  useEffect(() => {
    if (isOpen) setDraft(durations);
  }, [isOpen, durations]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize durations"
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="app-modal-btn-primary" onClick={() => onSave(draft)}>
            Save
          </button>
        </>
      }
    >
      <div
        className="pomopage-editor-rows"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(draft);
          }
        }}
      >
        {DURATION_ROWS.map((r) => (
          <label key={r.key} className="pomopage-editor-row">
            <span className="pomopage-editor-label">{r.label}</span>
            <span className="pomopage-editor-field">
              <input
                type="number"
                min={1}
                max={180}
                value={draft[r.key]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [r.key]: Number(e.target.value) }))
                }
              />
              <span className="pomopage-editor-unit">min</span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
};

export default PomodoroPage;
