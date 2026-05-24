import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db, requireUid } from "../firebase";

export type SessionType = "focus" | "break" | "long_break";

export interface StudySession {
  id: string;
  type: SessionType;
  startedAt: number;
  durationMs: number;
  completed: boolean;
  course?: string | null;
}

export interface StudySettings {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
  dailyGoalMin: number;
}

export interface StudyState {
  settings: StudySettings;
  streakDays: number;
  lastStudyDate: string | null;
  totalFocusMs: number;
  achievements: string[];
}

interface RunningTimer {
  type: SessionType;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  paused: boolean;
  pausedRemainingMs?: number;
  course?: string | null;
}

interface StudyContextProps {
  state: StudyState;
  sessions: StudySession[];
  timer: RunningTimer | null;
  remainingMs: number;
  cycleCount: number;
  todayFocusMs: number;
  startTimer: (type: SessionType, course?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Promise<void>;
  updateSettings: (s: Partial<StudySettings>) => Promise<void>;
}

const DEFAULT_STATE: StudyState = {
  settings: {
    focusMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    dailyGoalMin: 120,
  },
  streakDays: 0,
  lastStudyDate: null,
  totalFocusMs: 0,
  achievements: [],
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const StudyContext = createContext<StudyContextProps | undefined>(undefined);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StudyState>(DEFAULT_STATE);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [timer, setTimer] = useState<RunningTimer | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [cycleCount, setCycleCount] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) return;
      try {
        const uid = requireUid();
        const stateRef = doc(db, `users/${uid}/study/state`);
        const snap = await getDoc(stateRef);
        if (!cancelled && snap.exists()) {
          const data = snap.data() as Partial<StudyState>;
          setState({
            ...DEFAULT_STATE,
            ...data,
            settings: { ...DEFAULT_STATE.settings, ...(data.settings || {}) },
          });
        }
        const sessQ = query(
          collection(db, `users/${uid}/study/sessions/items`),
          orderBy("startedAt", "desc"),
          limit(200)
        );
        const sessSnap = await getDocs(sessQ);
        if (!cancelled) {
          setSessions(
            sessSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudySession, "id">) }))
          );
        }
      } catch (e) {
        console.error("StudyContext load error:", e);
      } finally {
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!timer || timer.paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer]);

  const remainingMs = useMemo(() => {
    if (!timer) return 0;
    if (timer.paused) return timer.pausedRemainingMs ?? 0;
    return Math.max(0, timer.endsAt - now);
  }, [timer, now]);

  const persistState = useCallback(async (next: StudyState) => {
    try {
      const uid = requireUid();
      await setDoc(doc(db, `users/${uid}/study/state`), next, { merge: true });
    } catch (e) {
      console.error("Persist study state failed:", e);
    }
  }, []);

  const recordSession = useCallback(
    async (session: Omit<StudySession, "id">) => {
      try {
        const uid = requireUid();
        const ref = await addDoc(
          collection(db, `users/${uid}/study/sessions/items`),
          session
        );
        setSessions((prev) => [{ id: ref.id, ...session }, ...prev]);
        return ref.id;
      } catch (e) {
        console.error("Record session failed:", e);
        return null;
      }
    },
    []
  );

  const computeAchievements = (s: StudyState, sess: StudySession[]): string[] => {
    const out = new Set(s.achievements);
    const focusCompleted = sess.filter((x) => x.type === "focus" && x.completed).length;
    if (focusCompleted >= 1) out.add("first-focus");
    if (focusCompleted >= 10) out.add("ten-focus");
    if (focusCompleted >= 50) out.add("fifty-focus");
    if (s.streakDays >= 3) out.add("streak-3");
    if (s.streakDays >= 7) out.add("streak-7");
    if (s.streakDays >= 30) out.add("streak-30");
    const hrs = s.totalFocusMs / 3_600_000;
    if (hrs >= 10) out.add("focus-10h");
    if (hrs >= 100) out.add("focus-100h");
    return Array.from(out);
  };

  const startTimer = useCallback(
    (type: SessionType, course?: string | null) => {
      const mins =
        type === "focus"
          ? state.settings.focusMin
          : type === "break"
          ? state.settings.breakMin
          : state.settings.longBreakMin;
      const durationMs = mins * 60_000;
      const startedAt = Date.now();
      setNow(startedAt);
      setTimer({
        type,
        startedAt,
        endsAt: startedAt + durationMs,
        durationMs,
        paused: false,
        course: course ?? null,
      });
    },
    [state.settings]
  );

  const pauseTimer = useCallback(() => {
    setTimer((t) => {
      if (!t || t.paused) return t;
      return { ...t, paused: true, pausedRemainingMs: Math.max(0, t.endsAt - Date.now()) };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((t) => {
      if (!t || !t.paused) return t;
      const rem = t.pausedRemainingMs ?? 0;
      const endsAt = Date.now() + rem;
      setNow(Date.now());
      return { ...t, paused: false, endsAt, pausedRemainingMs: undefined };
    });
  }, []);

  const finishTimer = useCallback(
    async (completed: boolean) => {
      const t = timer;
      if (!t) return;
      const elapsed = completed
        ? t.durationMs
        : t.paused
        ? t.durationMs - (t.pausedRemainingMs ?? 0)
        : Math.min(t.durationMs, Date.now() - t.startedAt);
      await recordSession({
        type: t.type,
        startedAt: t.startedAt,
        durationMs: elapsed,
        completed,
        course: t.course ?? null,
      });
      if (t.type === "focus" && completed) {
        setCycleCount((c) => c + 1);
        setState((prev) => {
          const today = todayStr();
          let streak = prev.streakDays;
          if (prev.lastStudyDate !== today) {
            if (prev.lastStudyDate === yesterdayStr()) streak += 1;
            else streak = 1;
          } else if (streak === 0) {
            streak = 1;
          }
          const next: StudyState = {
            ...prev,
            streakDays: streak,
            lastStudyDate: today,
            totalFocusMs: prev.totalFocusMs + elapsed,
          };
          const updated = { ...next, achievements: computeAchievements(next, [
            { id: "tmp", type: "focus", startedAt: t.startedAt, durationMs: elapsed, completed: true },
            ...sessions,
          ]) };
          persistState(updated);
          return updated;
        });
      }
      setTimer(null);
    },
    [timer, recordSession, persistState, sessions]
  );

  useEffect(() => {
    if (!timer || timer.paused) return;
    if (remainingMs <= 0) {
      finishTimer(true);
    }
  }, [remainingMs, timer, finishTimer]);

  const stopTimer = useCallback(async () => {
    await finishTimer(false);
  }, [finishTimer]);

  const updateSettings = useCallback(
    async (s: Partial<StudySettings>) => {
      setState((prev) => {
        const next = { ...prev, settings: { ...prev.settings, ...s } };
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const todayFocusMs = useMemo(() => {
    const today = todayStr();
    return sessions
      .filter((s) => s.type === "focus" && s.completed)
      .filter((s) => {
        const d = new Date(s.startedAt);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return ds === today;
      })
      .reduce((acc, s) => acc + s.durationMs, 0);
  }, [sessions]);

  return (
    <StudyContext.Provider
      value={{
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
      }}
    >
      {children}
    </StudyContext.Provider>
  );
};

export const useStudy = () => {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy must be used within StudyProvider");
  return ctx;
};
