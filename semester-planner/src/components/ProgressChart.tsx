import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import '../css/ProgressChart.css'

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProgressChartProps {
  completed?: number; // Optional to allow placeholder mode
  pending?: number;   // Optional to allow placeholder mode
}

const ProgressChart: React.FC<ProgressChartProps> = ({ completed = 0, pending = 0 }) => {
  const hasData = completed > 0 || pending > 0;

  const data = {
    labels: ["Completed", "Pending"],
    datasets: [
      {
        data: hasData ? [completed, pending] : [1],
        backgroundColor: hasData ? ["#4caf50", "#e0e0e0"] : ["#e0e0e0"], // Gray for placeholder
        hoverBackgroundColor: hasData ? ["#66bb6a", "#f5f5f5"] : ["#e0e0e0"],
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
        enabled: hasData,
      },
    },
  };

  return (
    <div style={{ width: "300px", height: "300px", margin: "0 auto", textAlign: "center" }}>
      <Doughnut data={data} options={options} />
      {!hasData && <p style={{ marginTop: "20px", color: "#999" }}></p>}
    </div>
  );
};

export default ProgressChart;
