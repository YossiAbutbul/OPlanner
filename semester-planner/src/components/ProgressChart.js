import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "../css/ProgressChart.css";
ChartJS.register(ArcElement, Tooltip, Legend);
const ProgressChart = ({ completed = 0, pending = 0, size = 300, }) => {
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
            mode: undefined,
            animation: false,
        },
    };
    return (_jsxs("div", { style: { textAlign: "center" }, children: [_jsxs("div", { style: {
                    width: `${size}px`,
                    height: `${size}px`,
                    margin: "0 auto",
                    position: "relative",
                    textAlign: "center",
                }, children: [_jsxs("div", { style: {
                            position: "relative",
                            display: "inline-block",
                            width: "100%",
                            height: "100%",
                        }, children: [_jsx(Doughnut, { data: data, options: options }), hasData && (_jsxs("div", { style: {
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    fontSize: "1.5rem",
                                    fontWeight: "bold",
                                    color: "#333",
                                }, children: [percentage, "%"] }))] }), !hasData && _jsx("p", { style: { marginTop: "20px", color: "#999" } })] }), _jsxs("p", { style: {
                    marginTop: "15px",
                    fontSize: "1rem",
                    color: "#bdbdbf",
                    fontWeight: "500",
                    fontStyle: "italic",
                }, children: [completed, " tasks completed out of ", total] })] }));
};
export default ProgressChart;
