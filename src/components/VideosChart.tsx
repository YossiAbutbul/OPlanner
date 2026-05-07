import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const VideosChart: React.FC<{ watched: number; notWatched: number }> = ({
  watched,
  notWatched,
}) => {
  const total = watched + notWatched;

  const data = {
    labels: ["Watched", "Not Watched"],
    datasets: [
      {
        data: [watched, notWatched],
        backgroundColor: ["#4caf50", "#e0e0e0"],
        hoverBackgroundColor: ["#66bb6a", "#f5f5f5"],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  return (
    <div className="progress-chart-container">
      <Doughnut data={data} options={options} />
      <div className="chart-label">
        {total > 0 ? Math.round((watched / total) * 100) : 0}%
      </div>
    </div>
  );
};

export default VideosChart;
