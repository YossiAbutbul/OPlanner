import React from "react";
import "../css/ProgressChart.css";
interface ProgressChartProps {
    completed?: number;
    pending?: number;
    size?: number;
}
declare const ProgressChart: React.FC<ProgressChartProps>;
export default ProgressChart;
