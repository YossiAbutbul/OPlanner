import React from "react";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from "chart.js";
import type { YearAverage } from "../../hooks/usePlanStats";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface Props {
  byYear: YearAverage[];
  target?: number;
}

// Average per academic year. The scale starts below the lowest grade rather
// than at zero, so a couple of points of movement is actually visible.
const GradesChart: React.FC<Props> = ({ byYear, target }) => {
  const values = byYear.map((y) => y.average);
  const floor = Math.max(0, Math.floor(Math.min(...values, target ?? 100) / 10) * 10 - 5);

  const data = {
    labels: byYear.map((y) => String(y.year)),
    datasets: [
      {
        data: values,
        backgroundColor: "#1db954",
        hoverBackgroundColor: "#1ed760",
        borderRadius: 8,
        borderSkipped: false as const,
        maxBarThickness: 64,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (ctx: TooltipItem<"bar">) =>
            `${(ctx.parsed.y ?? 0).toFixed(1)} average · ${byYear[ctx.dataIndex].credits} credits`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: "#e6e7ea" },
        ticks: { color: "#8d939b", font: { size: 13 } },
      },
      y: {
        min: floor,
        max: 100,
        grid: { color: "#f1f2f4" },
        border: { display: false },
        ticks: { color: "#8d939b", font: { size: 12 }, stepSize: 10 },
      },
    },
  };

  return (
    <div className="sp-grades-chart">
      <Bar data={data} options={options} />
    </div>
  );
};

export default GradesChart;
