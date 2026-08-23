import React, { useEffect, useRef, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  done: number;
  active: number;
  left: number;
  pct: number;
}

const SWEEP_MS = 1100;
const MIN_MS = 320;
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Same eased sweep the semester overview uses: the ring and the number climb
// together, and a later change glides from the current value.
const useProgress = (target: number): number => {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    if (from === target) return;
    const duration = Math.max(MIN_MS, (Math.abs(target - from) / 100) * SWEEP_MS);
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

// Degree progress as a doughnut: earned, in progress, and what is left.
const CreditsChart: React.FC<Props> = ({ done, active, left, pct }) => {
  const progress = useProgress(pct);
  const shown = Math.round(progress);
  const total = Math.max(1, done + active + left);
  // The earned slice grows with the eased value; the rest keeps the ring whole.
  const grown = (done / total) * (progress / Math.max(1, pct));

  const data = {
    labels: ["Earned", "In progress", "To go"],
    datasets: [
      {
        data: [grown, active / total, Math.max(0, 1 - grown - active / total)],
        backgroundColor: ["#1db954", "#f0a52a", "#e6e7ea"],
        hoverBackgroundColor: ["#1ed760", "#f5b544", "#dcdee2"],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    animation: false as const,
    hover: { mode: undefined, animation: false },
  };

  return (
    <div
      className="sp-credits-chart"
      role="progressbar"
      aria-label="Degree progress"
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <Doughnut data={data} options={options} />
      <div className="sp-credits-center">
        <span className="sp-credits-pct">{shown}%</span>
        <span className="sp-credits-word">of degree</span>
      </div>
    </div>
  );
};

export default CreditsChart;
