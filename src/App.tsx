import React, { useState } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [selectedCourseData, setSelectedCourseData] = useState<{
    year: number;
    semester: string;
    course?: string;
  } | null>(null);

  const onCourseOrSemesterSelect = (year: number, semester: string, course?: string) => {
    setSelectedCourseData({ year, semester, course });
  };

  if (loading) {
    return (
      <div className="app-loading">
        <i className="bx bx-loader-alt bx-spin"></i>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app-container">
      <Sidebar onCourseOrSemesterSelect={onCourseOrSemesterSelect} />
      <MainContent selectedCourseData={selectedCourseData} />
      <RightSidebar/>
    </div>
  );
};

export default App;
