import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCoins } from "./CoinsContext";
import { lsCache } from "../hooks/useLocalStorageCache";

export type PomodoroMode = "focus" | "short" | "long";

export interface PomodoroDurations {
  focus: number; // minutes
  short: number;
  long: number;
}

export const DEFAULT_DURATIONS: PomodoroDurations = { focus: 25, short: 5, long: 15 };

export const POMODORO_MODE_LABEL: Record<PomodoroMode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

const DURATIONS_KEY = "oplanner.pomodoro.durations";

const clampMin = (n: number) => Math.min(180, Math.max(1, Math.round(n) || 1));

interface PomodoroContextValue {
  mode: PomodoroMode;
  secondsLeft: number;
  running: boolean;
  focusDone: number;
  durations: PomodoroDurations;
  totalSeconds: number;
  progress: number; // 0..1 elapsed
  toggle: () => void;
  reset: () => void;
  switchMode: (m: PomodoroMode) => void;
  setDurations: (d: PomodoroDurations) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

// Owns the Pomodoro timer so it keeps ticking and earning coins regardless of
// which page is mounted. The page is just a view over this state.
export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { addCoins } = useCoins();

  const [durations, setDurationsState] = useState<PomodoroDurations>(
    () => lsCache.read<PomodoroDurations>(DURATIONS_KEY) ?? DEFAULT_DURATIONS
  );
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(() => durations.focus * 60);
  const [running, setRunning] = useState(false);
  const [focusDone, setFocusDone] = useState(0);

  // Whole running seconds; award 1 coin per completed minute of running.
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current % 60 === 0) addCoins(1);
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Session done: advance to next mode and auto-pause.
        setRunning(false);
        if (mode === "focus") {
          const done = focusDone + 1;
          setFocusDone(done);
          const next: PomodoroMode = done % 4 === 0 ? "long" : "short";
          setMode(next);
          return durations[next] * 60;
        }
        setMode("focus");
        return durations.focus * 60;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, focusDone, addCoins, durations]);

  const toggle = useCallback(() => setRunning((r) => !r), []);

  const reset = useCallback(() => {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
  }, [durations, mode]);

  const switchMode = useCallback(
    (next: PomodoroMode) => {
      setMode(next);
      setSecondsLeft(durations[next] * 60);
      setRunning(false);
    },
    [durations]
  );

  const setDurations = useCallback(
    (next: PomodoroDurations) => {
      const cleaned: PomodoroDurations = {
        focus: clampMin(next.focus),
        short: clampMin(next.short),
        long: clampMin(next.long),
      };
      setDurationsState(cleaned);
      lsCache.write(DURATIONS_KEY, cleaned);
      setRunning((r) => {
        if (!r) setSecondsLeft(cleaned[mode] * 60);
        return r;
      });
    },
    [mode]
  );

  const totalSeconds = durations[mode] * 60;
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  const value = useMemo<PomodoroContextValue>(
    () => ({
      mode,
      secondsLeft,
      running,
      focusDone,
      durations,
      totalSeconds,
      progress,
      toggle,
      reset,
      switchMode,
      setDurations,
    }),
    [mode, secondsLeft, running, focusDone, durations, totalSeconds, progress, toggle, reset, switchMode, setDurations]
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

export const usePomodoro = (): PomodoroContextValue => {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  return ctx;
};
