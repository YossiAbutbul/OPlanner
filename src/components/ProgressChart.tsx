import React, { useEffect, useRef, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "../css/ProgressChart.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const SWEEP_MS = 1100;
// Ease-in-out: slow at both the start and the end, faster through the middle.
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Eased 0 -> `target` progress over SWEEP_MS. Returns a float so the green
 * arc grows smoothly; callers round for the displayed %. The completed arc is
 * derived from this same value, so the bar fills as the number counts up.
 */
const useProgress = (target: number): number => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / SWEEP_MS, 1);
      setValue(easeInOutCubic(t) * target);
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
        backgroundColor: hasData ? ["#1db954", "#e3e3e6"] : ["#e3e3e6"],
        hoverBackgroundColor: hasData ? ["#1ed760", "#d6d6d9"] : ["#d6d6d9"],
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
