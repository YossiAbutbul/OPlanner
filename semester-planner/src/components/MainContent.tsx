import React from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";


import "../css/MainContent.css";
import { useHomework } from "../context/HomeworkContext";

const MainContent: React.FC = () => {
  const { homework } = useHomework();

  const completed = homework.filter((hw) => hw.status === "COMPLETED").length;
  const pending = homework.filter((hw) => hw.status === "PENDING").length;

  return (
    <div className="main-layout">
      {/* Main Content */}
      <div className="main-content">
        <h1>Course Progress</h1>
        <div className="progress-chart-container">
          <ProgressChart completed={completed} pending={pending} />
        </div>
        <div className="homework-table-container">
          <HomeworkTable />
        </div>
      </div>
    </div>
  );
};

export default MainContent;
