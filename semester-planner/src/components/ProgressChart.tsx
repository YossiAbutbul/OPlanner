import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "../css/ProgressChart.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProgressChartProps {
  completed?: number; // Optional to allow placeholder mode
  pending?: number;   // Optional to allow placeholder mode
  size?: number;      // New prop for size adjustment
}

const ProgressChart: React.FC<ProgressChartProps> = ({
  completed = 0,
  pending = 0,
  size = 300,
}) => {
  const hasData = completed > 0 || pending > 0;
  const total = completed + pending;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const data = {
    labels: ["Completed", "Pending"],
    datasets: [
      {
        data: hasData ? [completed, pending] : [1],
        backgroundColor: hasData ? ["#333", "#e0e0e0"] : ["#e0e0e0"], // Updated color
        hoverBackgroundColor: hasData ? ["#333", "#e0e0e0"] : ["#e0e0e0"], // Updated color
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
      tooltip: {
        enabled: false, // Disable tooltip
      },
    },
    hover: {
      mode: null,
      animation: false,
    },
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          margin: "0 auto",
          position: "relative",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            width: "100%",
            height: "100%",
          }}
        >
          <Doughnut data={data} options={options} />
          {hasData && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              {percentage}%
            </div>
          )}
        </div>
        {!hasData && <p style={{ marginTop: "20px", color: "#999" }}></p>}
      </div>
      {/* Title Below the Chart */}
      <p
        style={{
          marginTop: "15px",
          fontSize: "1rem",
          color: "#bdbdbf",
          fontWeight: "500",
          fontStyle: "italic",
        }}
      >
        {completed} tasks completed out of {total}
      </p>
    </div>
  );
};

export default ProgressChart;
