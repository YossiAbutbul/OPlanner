import React, { useState } from "react";
import { Play, Pause, Coins, Check } from "lucide-react";
import { useCoins } from "../context/CoinsContext";
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
        <div className="pomopage-coins" title="Coins earned">
          <Coins size={18} />
          {coins}
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

        <button
          className="pomopage-customize-toggle"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
        >
          {editing ? "Hide settings" : "Customize durations"}
        </button>

        {editing && (
          <DurationEditor
            durations={durations}
            onSave={(d) => {
              setDurations(d);
              setEditing(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

const DurationEditor: React.FC<{
  durations: PomodoroDurations;
  onSave: (d: PomodoroDurations) => void;
}> = ({ durations, onSave }) => {
  const [draft, setDraft] = useState<PomodoroDurations>(durations);
  const rows: { key: PomodoroMode; label: string }[] = [
    { key: "focus", label: "Focus" },
    { key: "short", label: "Short break" },
    { key: "long", label: "Long break" },
  ];
  return (
    <div className="pomopage-editor">
      <div className="pomopage-editor-title">Durations (minutes)</div>
      <div className="pomopage-editor-rows">
        {rows.map((r) => (
          <label key={r.key} className="pomopage-editor-row">
            <span>{r.label}</span>
            <input
              type="number"
              min={1}
              max={180}
              value={draft[r.key]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [r.key]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </div>
      <button className="pomopage-primary pomopage-editor-save" onClick={() => onSave(draft)}>
        <Check size={16} />
        <span>Save</span>
      </button>
    </div>
  );
};

export default PomodoroPage;
