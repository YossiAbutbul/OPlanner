import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);
const VideosChart = ({ watched, notWatched, }) => {
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
    return (_jsxs("div", { className: "progress-chart-container", children: [_jsx(Doughnut, { data: data, options: options }), _jsxs("div", { className: "chart-label", children: [total > 0 ? Math.round((watched / total) * 100) : 0, "%"] })] }));
};
export default VideosChart;
