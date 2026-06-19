import React, { useEffect, useRef, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useTheme } from "../context/ThemeContext";
import "../css/ProgressChart.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const SWEEP_MS = 1100;
const MIN_MS = 320;
// Ease-in-out: slow at both the start and the end, faster through the middle.
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Eased tween toward `target`. Always animates from the *current* value to the
 * new one, so the first paint sweeps 0 -> target while a later status change
 * glides gradually up or down from the old % — never a step, never a re-fill
 * from zero. Duration scales with the distance travelled (capped at SWEEP_MS).
 * Returns a float; callers round for the displayed %.
 */
const useProgress = (target: number): number => {
  const [value, setValue] = useState(0);
  // Latest committed value, read as the animation's start point without
  // re-triggering the tween effect. Synced in an effect (never during render).
  const valueRef = useRef(0);
  useEffect(() => { valueRef.current = value; }, [value]);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    if (from === target) return;
    const dist = Math.abs(target - from);
    const duration = Math.max(MIN_MS, (dist / 100) * SWEEP_MS);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / duration, 1);
      setValue(from + (target - from) * easeInOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return value;
};

interface ProgressChartProps {
  completed?: number;
  pending?: number;
}

const ProgressChart: React.FC<ProgressChartProps> = ({
  completed = 0,
  pending = 0,
}) => {
  const { theme } = useTheme();
  const dark = theme === "dark";
  // Mint accent + darker track in dark mode; brand green + light track in light.
  const arcColor = dark ? "#00d084" : "#1db954";
  const arcHover = dark ? "#1fe39b" : "#1ed760";
  const trackColor = dark ? "#2d2f31" : "#e3e3e6";
  const trackHover = dark ? "#3a3d40" : "#d6d6d9";
  const hasData = completed > 0 || pending > 0;
  const total = completed + pending;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progress = useProgress(percentage); // eased float 0 -> percentage
  const animatedPct = Math.round(progress);
  // Green arc grows with the same value; gray fills the remainder so the ring
  // stays whole while the completed segment climbs alongside the number.
  const fillFrac = total > 0 ? progress / 100 : 0;

  const data = {
    labels: ["Completed", "Pending"],
    datasets: [
      {
        data: hasData ? [fillFrac, 1 - fillFrac] : [1],
        backgroundColor: hasData ? [arcColor, trackColor] : [trackColor],
        hoverBackgroundColor: hasData ? [arcHover, trackHover] : [trackHover],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "55%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    // Our rAF loop drives the fill; chart.js's own tween would fight it.
    animation: false as const,
    hover: { mode: undefined, animation: false },
  };

  return (
    <div className="progress-card">
      <div className="progress-card-header">Progress</div>
      <div className="progress-donut-wrap">
        <Doughnut data={data} options={options} />
        {hasData && (
          <div className="progress-center">
            <span className="progress-pct">{animatedPct}%</span>
          </div>
        )}
        {!hasData && (
          <div className="progress-center">
            <span className="progress-empty">No tasks</span>
          </div>
        )}
      </div>
      <p className="progress-subtitle">
        {completed} tasks completed out of {total}
      </p>
    </div>
  );
};

export default ProgressChart;
