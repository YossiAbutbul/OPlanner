import React, { useMemo, useState } from "react";
import { useStudy, SessionType } from "../context/StudyContext";
import Modal from "./Modal";
import {
  VILLAGERS,
  RARITY_META,
  computeVillageStats,
  isUnlocked,
  unlockProgress,
} from "../utility/village";
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

type Tab = "timer" | "stats" | "achievements" | "village";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const RING_RADIUS = 120;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const StudyWidget: React.FC = () => {
  const {
    state,
    sessions,
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
  const [tab, setTab] = useState<Tab>("timer");
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const ringProgress = useMemo(() => {
    if (!timer) return 0;
    return 1 - remainingMs / timer.durationMs;
  }, [timer, remainingMs]);

  const dashOffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  const unlockedCount = state.achievements.length;
  const totalAchievements = Object.keys(ACHIEVEMENT_META).length;

  const villageStats = useMemo(
    () => computeVillageStats(state, sessions),
    [state, sessions]
  );
  const villagerStatuses = useMemo(
    () => VILLAGERS.map((v) => ({ v, unlocked: isUnlocked(v, villageStats) })),
    [villageStats]
  );
  const villagersUnlocked = villagerStatuses.filter((x) => x.unlocked).length;
  const unlockedVillagers = villagerStatuses.filter((x) => x.unlocked);

  return (
    <>
      <button
        type="button"
        className={`study-fab ${timer ? "running" : ""}`}
        onClick={() => setOpen(true)}
        title="Study"
        aria-label="Open study"
      >
        {timer ? <span className="study-fab-time">{fmt(remainingMs)}</span> : <span>🍅</span>}
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Study">
        <div className="study-wrap">
          <nav className="study-tabs" role="tablist">
            <button
              role="tab"
              className={`study-tab ${tab === "timer" ? "active" : ""}`}
              onClick={() => setTab("timer")}
            >
              Timer
            </button>
            <button
              role="tab"
              className={`study-tab ${tab === "stats" ? "active" : ""}`}
              onClick={() => setTab("stats")}
            >
              Stats
            </button>
            <button
              role="tab"
              className={`study-tab ${tab === "achievements" ? "active" : ""}`}
              onClick={() => setTab("achievements")}
            >
              <span>Awards</span>
              <span className="study-tab-meta">
                {unlockedCount}/{totalAchievements}
              </span>
            </button>
            <button
              role="tab"
              className={`study-tab ${tab === "village" ? "active" : ""}`}
              onClick={() => setTab("village")}
            >
              <span>Village</span>
              <span className="study-tab-meta">
                {villagersUnlocked}/{VILLAGERS.length}
              </span>
            </button>
          </nav>

          <div className="study-tab-content">
            {tab === "timer" && (
              <div className={`study-panel ${phaseClass}`}>
                <div className="study-ring-wrap">
                  <svg
                    className="study-ring"
                    viewBox="0 0 280 280"
                    width="260"
                    height="260"
                  >
                    <circle
                      cx="140"
                      cy="140"
                      r={RING_RADIUS}
                      className="study-ring-track"
                    />
                    <circle
                      cx="140"
                      cy="140"
                      r={RING_RADIUS}
                      className="study-ring-progress"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 140 140)"
                    />
                  </svg>
                  <div className="study-ring-text">
                    <div className="study-phase">{timer ? typeLabel[timer.type] : "Ready"}</div>
                    <div className="study-time">
                      {timer ? fmt(remainingMs) : fmt(state.settings.focusMin * 60_000)}
                    </div>
                    {timer && timer.paused && <div className="study-paused">Paused</div>}
                  </div>
                </div>

                <div className="study-controls">
                  {!timer && (
                    <>
                      <button
                        className="study-btn primary lg"
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

                <button
                  className="study-link"
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                >
                  Timer settings
                </button>
              </div>
            )}

            {tab === "stats" && (
              <div className="study-stats-tab">
                <div className="study-stat-card big">
                  <div className="study-stat-label">Today</div>
                  <div className="study-stat-value">
                    {Math.round(todayFocusMs / 60_000)}
                    <span className="study-stat-unit"> / {state.settings.dailyGoalMin} min</span>
                  </div>
                  <div className="study-progress">
                    <div className="study-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="study-stat-foot">{pct}% of daily goal</div>
                </div>
                <div className="study-stat-grid">
                  <div className="study-stat-card">
                    <div className="study-stat-label">Streak</div>
                    <div className="study-stat-value">
                      {state.streakDays}
                      <span className="study-stat-unit"> day{state.streakDays === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="study-stat-card">
                    <div className="study-stat-label">Total focus</div>
                    <div className="study-stat-value">
                      {Math.round((state.totalFocusMs / 3_600_000) * 10) / 10}
                      <span className="study-stat-unit">h</span>
                    </div>
                  </div>
                  <div className="study-stat-card">
                    <div className="study-stat-label">Cycles today</div>
                    <div className="study-stat-value">{cycleCount}</div>
                  </div>
                  <div className="study-stat-card">
                    <div className="study-stat-label">Awards</div>
                    <div className="study-stat-value">
                      {unlockedCount}
                      <span className="study-stat-unit"> / {totalAchievements}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "village" && (
              <div className="village">
                <div className="village-scene">
                  <div className="village-sky" />
                  <div className="village-ground" />
                  <div className="village-residents">
                    {unlockedVillagers.length === 0 ? (
                      <div className="village-empty-scene">
                        Complete a focus session to plant your first villager.
                      </div>
                    ) : (
                      unlockedVillagers.map(({ v }, i) => (
                        <span
                          key={v.id}
                          className="village-resident"
                          style={{
                            left: `${5 + ((i * 17) % 85)}%`,
                            animationDelay: `${(i % 5) * 0.3}s`,
                          }}
                          title={`${v.name} — ${v.title}`}
                        >
                          {v.emoji}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="village-summary">
                  <span>
                    <strong>{villagersUnlocked}</strong> / {VILLAGERS.length} villagers
                  </span>
                  <span className="village-summary-hint">
                    Earn focus hours, streaks, and awards to recruit more.
                  </span>
                </div>

                <div className="village-grid">
                  {villagerStatuses.map(({ v, unlocked }) => {
                    const prog = unlockProgress(v, villageStats);
                    const pctV =
                      prog.target > 0
                        ? Math.min(100, Math.round((prog.current / prog.target) * 100))
                        : 0;
                    const rarity = RARITY_META[v.rarity];
                    return (
                      <div
                        key={v.id}
                        className={`village-card ${unlocked ? "unlocked" : "locked"} rarity-${v.rarity}`}
                        style={{ borderColor: unlocked ? rarity.color : rarity.ring }}
                      >
                        <div
                          className="village-card-avatar"
                          style={{
                            background: unlocked
                              ? `linear-gradient(135deg, ${rarity.ring}, #fff)`
                              : "#f3f4f6",
                          }}
                        >
                          <span className="village-card-emoji">
                            {unlocked ? v.emoji : "❔"}
                          </span>
                        </div>
                        <div className="village-card-body">
                          <div className="village-card-head">
                            <div className="village-card-name">
                              {unlocked ? v.name : "???"}
                            </div>
                            <div
                              className="village-card-rarity"
                              style={{ color: rarity.color }}
                            >
                              {rarity.label}
                            </div>
                          </div>
                          <div className="village-card-title">
                            {unlocked ? v.title : "Locked"}
                          </div>
                          <div className="village-card-blurb">
                            {unlocked ? v.blurb : prog.label}
                          </div>
                          {!unlocked && (
                            <div className="study-progress thin">
                              <div
                                className="study-progress-bar"
                                style={{
                                  width: `${pctV}%`,
                                  background: rarity.color,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "achievements" && (
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
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Timer settings"
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
    </>
  );
};

export default StudyWidget;
