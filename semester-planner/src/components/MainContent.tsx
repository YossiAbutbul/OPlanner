import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import "../css/MainContent.css";
import { useHomework } from "../context/HomeworkContext";

interface MainContentProps {
  selectedCourse: string | null;
}

const MainContent: React.FC<MainContentProps> = ({ selectedCourse }) => {
  const { homework } = useHomework();

  const [filteredHomework, setFilteredHomework] = useState(homework);

  useEffect(() => {
    if (selectedCourse) {
      // Filter tasks by the selected course
      const courseTasks = homework.filter((hw) => hw.course === selectedCourse);
      setFilteredHomework(courseTasks);
    } else {
      setFilteredHomework([]);
    }
  }, [homework, selectedCourse]);

  const completed = filteredHomework.filter((hw) => hw.status === "COMPLETED").length;
  const pending = filteredHomework.filter((hw) => hw.status === "PENDING").length;

  return (
    <div className="main-layout">
      <div className="main-content">
        <h1>Course Progress</h1>
        {selectedCourse ? (
          <>
            <h2>Progress for {selectedCourse}</h2>
            <div className="progress-chart-container">
              <ProgressChart completed={completed} pending={pending} />
            </div>
            <div className="homework-table-container">
              <HomeworkTable tasks={filteredHomework} />
            </div>
          </>
        ) : (
          <p>Please select a course from the sidebar to view its progress.</p>
        )}
      </div>
    </div>
  );
};

export default MainContent;
