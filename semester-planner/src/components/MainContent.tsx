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
  const [isLoadingAction, setIsLoadingAction] = useState(false); // New state for action loading

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

  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  };

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
    const capitalizedCourse = capitalizeWords(course);

    try {
      setIsLoadingAction(true); // Start loading
      await addHomework(id, name, dueDate, status, year, semester, capitalizedCourse);
      await fetchHomework(year, semester, capitalizedCourse); // Refresh homework list after saving
      setModalOpen(false); // Close the modal after saving
    } catch (error) {
      console.error("Error saving homework:", error);
    } finally {
      setIsLoadingAction(false); // End loading
    }
  };

  return (
    <div className="main-layout">
      <div className="main-content">
        {selectedCourseData ? (
          <>
            <h1>Course Progress</h1>
            <h2>
              Progress for {capitalizeWords(selectedCourseData.course)} in{" "}
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
        isLoading={isLoadingAction} // Pass loading state to modal
      />
    </div>
  );
};

export default MainContent;
