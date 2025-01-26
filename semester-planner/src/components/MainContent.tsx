import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";

interface MainContentProps {
  selectedCourseData: {
    year: number;
    semester: string;
    course: string;
  } | null;
}

const MainContent: React.FC<MainContentProps> = ({ selectedCourseData }) => {
  const { homework, fetchHomework, addHomework } = useHomework();
  const [filteredHomework, setFilteredHomework] = useState<HomeworkEntry[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);

  // Fetch homework whenever the selected course changes
  useEffect(() => {
    if (selectedCourseData) {
      const { year, semester, course } = selectedCourseData;
      if (course) {
        fetchHomework(year, semester, course);
      }
    }
  }, [selectedCourseData, fetchHomework]);

  // Filter homework for the selected course
  useEffect(() => {
    if (selectedCourseData) {
      const { course } = selectedCourseData;
      setFilteredHomework(homework.filter((hw) => hw.course === course));
    } else {
      setFilteredHomework([]);
    }
  }, [selectedCourseData, homework]);

  // Handle saving new homework or updating existing homework
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
      await addHomework(id, name, dueDate, status, year, semester, course);
      await fetchHomework(year, semester, course); // Refresh homework list after saving
      setModalOpen(false); // Close the modal after saving
    } catch (error) {
      console.error("Error saving homework:", error);
    }
  };

  return (
    <div className="main-layout">
      <div className="main-content">
        {selectedCourseData ? (
          <>
            <h1>Course Progress</h1>
            <h2>
              Progress for {selectedCourseData.course} in{" "}
              {selectedCourseData.semester}, {selectedCourseData.year}
            </h2>
            <div className="progress-chart-container">
              <ProgressChart
                completed={filteredHomework.filter((hw) => hw.status === "COMPLETED").length}
                pending={filteredHomework.filter((hw) => hw.status === "PENDING").length}
              />
            </div>
            <div className="homework-table-container">
              <HomeworkTable
                tasks={filteredHomework}
                onAddTask={() => setModalOpen(true)}
              />
            </div>
          </>
        ) : (
          <>
            <h1>Course Progress</h1>
            <p>Please select a course from the sidebar to view its progress.</p>
          </>
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
