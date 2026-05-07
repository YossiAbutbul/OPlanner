import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "../css/ProgressChart.css";

ChartJS.register(ArcElement, Tooltip, Legend);

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

  const data = {
    labels: ["Completed", "Pending"],
    datasets: [
      {
        data: hasData ? [completed, pending] : [1],
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
    animation: {
      duration: 900,
      easing: "easeOutCubic" as const,
      animateRotate: true,
      animateScale: false,
    },
    hover: { mode: undefined, animation: false },
  };

  return (
    <div className="progress-card">
      <div className="progress-card-header">Progress</div>
      <div className="progress-donut-wrap">
        <Doughnut data={data} options={options} />
        {hasData && (
          <div className="progress-center">
            <span className="progress-pct">{percentage}%</span>
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
