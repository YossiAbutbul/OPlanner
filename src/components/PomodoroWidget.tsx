import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Coins, Timer, Settings, Check } from "lucide-react";
import { useCoins } from "../context/CoinsContext";
import { lsCache } from "../hooks/useLocalStorageCache";
import "../css/Pomodoro.css";

type Mode = "focus" | "short" | "long";

interface Durations {
  focus: number; // minutes
  short: number;
  long: number;
}

// Classic Pomodoro defaults: 25 focus, 5 short break, 15 long break every 4.
const DEFAULT_DURATIONS: Durations = { focus: 25, short: 5, long: 15 };

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

const POS_KEY = "oplanner.pomodoro.pos";
const COLLAPSED_KEY = "oplanner.pomodoro.collapsed";
const DURATIONS_KEY = "oplanner.pomodoro.durations";

// Progress-ring geometry (240x240 viewBox, r=104 leaves room for stroke).
const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;

const clampMin = (n: number) => Math.min(180, Math.max(1, Math.round(n) || 1));

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// Minus icon is <line>-based and doesn't render on our lucide build, so the
// minimize control uses an inline path-based glyph instead.
const MinimizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12h14"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const PomodoroWidget: React.FC = () => {
  const { coins, addCoins } = useCoins();

  const [durations, setDurations] = useState<Durations>(
    () => lsCache.read<Durations>(DURATIONS_KEY) ?? DEFAULT_DURATIONS
  );
  const secondsFor = useCallback(
    (m: Mode) => durations[m] * 60,
    [durations]
  );

  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(() => durations.focus * 60);
  const [running, setRunning] = useState(false);
  const [focusDone, setFocusDone] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => lsCache.read<boolean>(COLLAPSED_KEY) ?? false
  );
  const [editing, setEditing] = useState(false);

  // Whole running seconds since mount; award 1 coin per completed minute.
  const elapsedRef = useRef(0);

  // ----- Drag -----
  const [pos, setPos] = useState<{ x: number; y: number }>(
    () =>
      lsCache.read<{ x: number; y: number }>(POS_KEY) ?? {
        x: window.innerWidth - 300,
        y: window.innerHeight - 420,
      }
  );
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = collapsed ? 160 : 270;
    const h = collapsed ? 56 : 360;
    const x = Math.min(Math.max(0, e.clientX - d.dx), window.innerWidth - w);
    const y = Math.min(Math.max(0, e.clientY - d.dy), window.innerHeight - h);
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    lsCache.write(POS_KEY, pos);
  };

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setSecondsLeft(durations[next] * 60);
      setRunning(false);
    },
    [durations]
  );

  // ----- Tick -----
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current % 60 === 0) addCoins(1);
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        setRunning(false);
        if (mode === "focus") {
          const done = focusDone + 1;
          setFocusDone(done);
          const next: Mode = done % 4 === 0 ? "long" : "short";
          setMode(next);
          return durations[next] * 60;
        }
        setMode("focus");
        return durations.focus * 60;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, focusDone, addCoins, durations]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(secondsFor(mode));
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      lsCache.write(COLLAPSED_KEY, !c);
      return !c;
    });
  };

  // Apply edited durations: persist, reset the current (non-running) timer.
  const saveDurations = (next: Durations) => {
    const cleaned: Durations = {
      focus: clampMin(next.focus),
      short: clampMin(next.short),
      long: clampMin(next.long),
    };
    setDurations(cleaned);
    lsCache.write(DURATIONS_KEY, cleaned);
    setEditing(false);
    if (!running) setSecondsLeft(cleaned[mode] * 60);
  };

  const total = secondsFor(mode);
  const progress = total > 0 ? 1 - secondsLeft / total : 0;

  if (collapsed) {
    return (
      <div
        className="pomo pomo-collapsed"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <button
          className="pomo-pill-toggle"
          onClick={toggleCollapsed}
          title="Open Pomodoro"
          aria-label="Open Pomodoro timer"
        >
          <Timer size={16} />
          <span className="pomo-pill-time">{fmt(secondsLeft)}</span>
        </button>
        <span className="pomo-pill-coins" title="Coins">
          <Coins size={14} />
          {coins}
        </span>
      </div>
    );
  }

  return (
    <div className={`pomo pomo-mode-${mode}`} style={{ left: pos.x, top: pos.y }}>
      <div
        className="pomo-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="pomo-title">
          <Timer size={15} />
          Pomodoro
        </span>
        <span className="pomo-coins" title="Coins earned">
          <Coins size={14} />
          {coins}
        </span>
        <button
          className="pomo-icon-btn"
          onClick={() => setEditing((e) => !e)}
          title="Settings"
          aria-label="Customize durations"
          aria-pressed={editing}
        >
          <Settings size={15} />
        </button>
        <button
          className="pomo-icon-btn"
          onClick={toggleCollapsed}
          title="Minimize"
          aria-label="Minimize Pomodoro"
        >
          <MinimizeIcon />
        </button>
      </div>

      {editing ? (
        <DurationEditor durations={durations} onSave={saveDurations} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="pomo-modes">
            {(["focus", "short", "long"] as Mode[]).map((m) => (
              <button
                key={m}
                className={`pomo-mode-btn ${mode === m ? "active" : ""}`}
                onClick={() => switchMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          <div className="pomo-ring-wrap">
            <svg className="pomo-ring" viewBox="0 0 240 240" aria-hidden>
              <circle className="pomo-ring-track" cx="120" cy="120" r={RING_R} />
              <circle
                className="pomo-ring-fill"
                cx="120"
                cy="120"
                r={RING_R}
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - progress)}
              />
            </svg>
            <div className="pomo-ring-center">
              <div className="pomo-time" role="timer" aria-live="off">
                {fmt(secondsLeft)}
              </div>
              <div className="pomo-session">
                {mode === "focus" ? `Round ${(focusDone % 4) + 1} / 4` : MODE_LABEL[mode]}
              </div>
            </div>
          </div>

          <div className="pomo-controls">
            <button className="pomo-primary" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={18} /> : <Play size={18} />}
              <span>{running ? "Pause" : "Start"}</span>
            </button>
            <button className="pomo-ghost" onClick={reset} title="Reset" aria-label="Reset">
              <RotateCcw size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ----- Inline duration editor -----
const DurationEditor: React.FC<{
  durations: Durations;
  onSave: (d: Durations) => void;
  onCancel: () => void;
}> = ({ durations, onSave, onCancel }) => {
  const [draft, setDraft] = useState<Durations>(durations);
  const rows: { key: Mode; label: string }[] = [
    { key: "focus", label: "Focus" },
    { key: "short", label: "Short break" },
    { key: "long", label: "Long break" },
  ];
  return (
    <div className="pomo-editor">
      <div className="pomo-editor-title">Durations (minutes)</div>
      {rows.map((r) => (
        <label key={r.key} className="pomo-editor-row">
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
      <div className="pomo-editor-actions">
        <button className="pomo-ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="pomo-primary pomo-editor-save" onClick={() => onSave(draft)}>
          <Check size={16} />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
};

export default PomodoroWidget;
