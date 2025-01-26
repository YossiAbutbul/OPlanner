import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";

// Removed duplicate HomeworkEntry interface

interface MainContentProps {

  selectedCourseData: {

    year: number;

    semester: string;

    course: string;

  } | null;

}


const MainContent: React.FC<MainContentProps> = ({ selectedCourseData }) => {
  const { homework, fetchHomework, addHomework } = useHomework();
  const [isModalOpen, setModalOpen] = useState(false);
  const [filteredHomework, setFilteredHomework] = useState<HomeworkEntry[]>([]);

  // Fetch homework whenever the selected course changes
  useEffect(() => {
    if (selectedCourseData) {
      const { year, semester, course } = selectedCourseData;
      if (course) {
        fetchHomework(year, semester, course); // Fetch homework for the selected course
      }
    }
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

  const handleSaveHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    if (!selectedCourseData) {
      alert("Please select a valid course.");
      return;
    }

    const { year, semester, course } = selectedCourseData;

    try {
      if (course) {
        await addHomework(id, name, dueDate, status, year, semester, course);
      } else {
        console.error("Course is undefined");
      }
      if (course) {
        await fetchHomework(year, semester, course); // Refresh after adding
      } else {
        console.error("Course is undefined");
      }
    } catch (error) {
      console.error("Error saving homework:", error);
    }
  };

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
              <HomeworkTable
                tasks={filteredHomework}
                onAddTask={() => setModalOpen(true)}
              />
            </div>
          </>
        ) : (
          <p>Please select a course from the sidebar to view its progress.</p>
        )}
      </div>

      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveHomework}
        selectedCourseData={selectedCourseData}
      />
    </div>
  );
};

export default MainContent;
