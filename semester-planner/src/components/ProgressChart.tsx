import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProgressChartProps {
  completed: number;
  total: number;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ completed, total }) => {
  const data = {
    labels: ['Completed', 'Remaining'],
    datasets: [
      {
        data: [completed, total - completed],
        backgroundColor: ['#4caf50', '#e0e0e0'],
        hoverBackgroundColor: ['#66bb6a', '#f5f5f5'],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
  };

  return <Doughnut data={data} options={options} />;
};

export default ProgressChart;
