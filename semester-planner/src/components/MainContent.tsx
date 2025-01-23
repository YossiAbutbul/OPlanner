import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import "../css/MainContent.css";
import { useHomework } from "../context/HomeworkContext";

interface MainContentProps {
  selectedCourseData: {
    year: number;
    semester: string;
    course: string;
  } | null;
}

const MainContent: React.FC<MainContentProps> = ({ selectedCourseData }) => {
  const { homework, fetchHomework } = useHomework();
  const [filteredHomework, setFilteredHomework] = useState(homework);

  // Fetch homework when selectedCourseData changes
  useEffect(() => {
    const fetchTasks = async () => {
      if (selectedCourseData) {
        const { year, semester } = selectedCourseData;
        await fetchHomework(year.toString(), semester); // Fetch tasks for the selected year/semester
      }
    };

    fetchTasks();
  }, [selectedCourseData, fetchHomework]);

  // Filter homework for the selected course
  useEffect(() => {
    if (selectedCourseData) {
      const { course } = selectedCourseData;
      const courseTasks = homework.filter((hw) => hw.course === course);
      setFilteredHomework(courseTasks);
    } else {
      setFilteredHomework([]);
    }
  }, [homework, selectedCourseData]);

  const completed = filteredHomework.filter((hw) => hw.status === "COMPLETED").length;
  const pending = filteredHomework.filter((hw) => hw.status === "PENDING").length;

  return (
    <div className="main-layout">
      <div className="main-content">
        <h1>Course Progress</h1>
        {selectedCourseData ? (
          <>
            <h2>
              Progress for {selectedCourseData.course} in{" "}
              {selectedCourseData.semester}, {selectedCourseData.year}
            </h2>
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
