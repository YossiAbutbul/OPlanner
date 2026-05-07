import React, { useState } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";

const App: React.FC = () => {
  const [selectedCourseData, setSelectedCourseData] = useState<{
    year: number;
    semester: string;
    course?: string;
  } | null>(null);

  const onCourseOrSemesterSelect = (year: number, semester: string, course?: string) => {
    setSelectedCourseData({ year, semester, course });
  };

  return (
    <div className="app-container">
      <Sidebar onCourseOrSemesterSelect={onCourseOrSemesterSelect} />
      <MainContent selectedCourseData={selectedCourseData} />
      <RightSidebar/>
    </div>
  );
};

export default App;
