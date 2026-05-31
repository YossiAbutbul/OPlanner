import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Coins, Timer, Minus } from "lucide-react";
import { useCoins } from "../context/CoinsContext";
import { lsCache } from "../hooks/useLocalStorageCache";
import "../css/Pomodoro.css";

type Mode = "focus" | "short" | "long";

// Classic Pomodoro: 25 focus, 5 short break, 15 long break every 4 focuses.
const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

const POS_KEY = "oplanner.pomodoro.pos";
const COLLAPSED_KEY = "oplanner.pomodoro.collapsed";

// Progress-ring geometry (240x240 viewBox, r=104 leaves room for stroke).
const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const PomodoroWidget: React.FC = () => {
  const { coins, addCoins } = useCoins();

  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [focusDone, setFocusDone] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => lsCache.read<boolean>(COLLAPSED_KEY) ?? false
  );

  // Whole running seconds since mount; award 1 coin per completed minute.
  const elapsedRef = useRef(0);

  // ----- Drag -----
  const [pos, setPos] = useState<{ x: number; y: number }>(
    () =>
      lsCache.read<{ x: number; y: number }>(POS_KEY) ?? {
        x: window.innerWidth - 280,
        y: window.innerHeight - 220,
      }
  );
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore drags that start on a button.
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = collapsed ? 150 : 250;
    const h = collapsed ? 56 : 210;
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

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setSecondsLeft(DURATIONS[next]);
    setRunning(false);
  }, []);

  // ----- Tick -----
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current % 60 === 0) addCoins(1);
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Session complete: advance to the next mode and auto-pause.
        setRunning(false);
        if (mode === "focus") {
          const done = focusDone + 1;
          setFocusDone(done);
          const next: Mode = done % 4 === 0 ? "long" : "short";
          setMode(next);
          return DURATIONS[next];
        }
        setMode("focus");
        return DURATIONS.focus;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, focusDone, addCoins]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(DURATIONS[mode]);
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      lsCache.write(COLLAPSED_KEY, !c);
      return !c;
    });
  };

  const total = DURATIONS[mode];
  const progress = 1 - secondsLeft / total;

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
    <div
      className={`pomo pomo-mode-${mode}`}
      style={{ left: pos.x, top: pos.y }}
    >
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
          className="pomo-min"
          onClick={toggleCollapsed}
          title="Minimize"
          aria-label="Minimize Pomodoro"
        >
          <Minus size={15} />
        </button>
      </div>

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

      {/* Circular progress ring with the time in the center. */}
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
        <button
          className="pomo-primary"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          <span>{running ? "Pause" : "Start"}</span>
        </button>
        <button className="pomo-ghost" onClick={reset} title="Reset" aria-label="Reset">
          <RotateCcw size={17} />
        </button>
      </div>
    </div>
  );
};

export default PomodoroWidget;
