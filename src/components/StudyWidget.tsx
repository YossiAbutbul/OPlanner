import React, { useState } from "react";
import { useStudy, SessionType } from "../context/StudyContext";
import Modal from "./Modal";
import "../css/StudyWidget.css";

const ACHIEVEMENT_META: Record<string, { label: string; icon: string }> = {
  "first-focus": { label: "First focus session", icon: "🌱" },
  "ten-focus": { label: "10 focus sessions", icon: "🔥" },
  "fifty-focus": { label: "50 focus sessions", icon: "🏆" },
  "streak-3": { label: "3-day streak", icon: "⚡" },
  "streak-7": { label: "7-day streak", icon: "🌟" },
  "streak-30": { label: "30-day streak", icon: "💎" },
  "focus-10h": { label: "10 hours focused", icon: "📚" },
  "focus-100h": { label: "100 hours focused", icon: "🎓" },
};

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const StudyWidget: React.FC = () => {
  const {
    state,
    timer,
    remainingMs,
    cycleCount,
    todayFocusMs,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    updateSettings,
  } = useStudy();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);

  const goalMs = state.settings.dailyGoalMin * 60_000;
  const pct = goalMs > 0 ? Math.min(100, Math.round((todayFocusMs / goalMs) * 100)) : 0;

  const nextBreakType: SessionType =
    cycleCount > 0 && cycleCount % state.settings.longBreakEvery === 0
      ? "long_break"
      : "break";

  const typeLabel: Record<SessionType, string> = {
    focus: "Focus",
    break: "Break",
    long_break: "Long break",
  };

  const phaseClass = timer ? `phase-${timer.type}` : "phase-idle";

  return (
    <>
      <button
        type="button"
        className={`study-fab ${timer ? "running" : ""}`}
        onClick={() => setOpen(true)}
        title="Study timer"
        aria-label="Open study timer"
      >
        {timer ? <span className="study-fab-time">{fmt(remainingMs)}</span> : <span>🍅</span>}
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Study"
        footer={
          <>
            <button
              type="button"
              className="app-modal-btn-cancel"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
            <button
              type="button"
              className="app-modal-btn-cancel"
              onClick={() => setAchOpen(true)}
            >
              Achievements
            </button>
            <button
              type="button"
              className="app-modal-btn-primary"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </>
        }
      >
        <div className={`study-panel ${phaseClass}`}>
          <div className="study-timer-display">
            <div className="study-phase">{timer ? typeLabel[timer.type] : "Ready"}</div>
            <div className="study-time">
              {timer ? fmt(remainingMs) : fmt(state.settings.focusMin * 60_000)}
            </div>
          </div>

          <div className="study-controls">
            {!timer && (
              <>
                <button
                  className="study-btn primary"
                  onClick={() => startTimer("focus")}
                >
                  Start focus
                </button>
                <button
                  className="study-btn"
                  onClick={() => startTimer(nextBreakType)}
                >
                  {nextBreakType === "long_break" ? "Long break" : "Short break"}
                </button>
              </>
            )}
            {timer && !timer.paused && (
              <button className="study-btn" onClick={pauseTimer}>
                Pause
              </button>
            )}
            {timer && timer.paused && (
              <button className="study-btn primary" onClick={resumeTimer}>
                Resume
              </button>
            )}
            {timer && (
              <button className="study-btn danger" onClick={stopTimer}>
                Stop
              </button>
            )}
          </div>

          <div className="study-stats">
            <div className="study-stat">
              <div className="study-stat-label">Today</div>
              <div className="study-stat-value">
                {Math.round(todayFocusMs / 60_000)} / {state.settings.dailyGoalMin} min
              </div>
              <div className="study-progress">
                <div className="study-progress-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="study-stat">
              <div className="study-stat-label">Streak</div>
              <div className="study-stat-value">
                {state.streakDays} day{state.streakDays === 1 ? "" : "s"}
              </div>
            </div>
            <div className="study-stat">
              <div className="study-stat-label">Total</div>
              <div className="study-stat-value">
                {Math.round(state.totalFocusMs / 3_600_000 * 10) / 10}h
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Study settings"
        footer={
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={() => setSettingsOpen(false)}
          >
            Done
          </button>
        }
      >
        <div className="study-settings">
          <label>
            Focus length (min)
            <input
              type="number"
              min={1}
              max={180}
              value={state.settings.focusMin}
              onChange={(e) =>
                updateSettings({ focusMin: Math.max(1, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label>
            Short break (min)
            <input
              type="number"
              min={1}
              max={60}
              value={state.settings.breakMin}
              onChange={(e) =>
                updateSettings({ breakMin: Math.max(1, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label>
            Long break (min)
            <input
              type="number"
              min={1}
              max={120}
              value={state.settings.longBreakMin}
              onChange={(e) =>
                updateSettings({ longBreakMin: Math.max(1, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label>
            Long break every (focus sessions)
            <input
              type="number"
              min={1}
              max={20}
              value={state.settings.longBreakEvery}
              onChange={(e) =>
                updateSettings({ longBreakEvery: Math.max(1, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label>
            Daily goal (min)
            <input
              type="number"
              min={0}
              max={1440}
              value={state.settings.dailyGoalMin}
              onChange={(e) =>
                updateSettings({ dailyGoalMin: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={achOpen}
        onClose={() => setAchOpen(false)}
        title="Achievements"
        footer={
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={() => setAchOpen(false)}
          >
            Close
          </button>
        }
      >
        <div className="study-achievements">
          {Object.entries(ACHIEVEMENT_META).map(([id, meta]) => {
            const unlocked = state.achievements.includes(id);
            return (
              <div
                key={id}
                className={`study-ach ${unlocked ? "unlocked" : "locked"}`}
              >
                <span className="study-ach-icon">{meta.icon}</span>
                <span className="study-ach-label">{meta.label}</span>
                {unlocked && <span className="study-ach-badge">✓</span>}
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
};

export default StudyWidget;
