import React, { useState } from 'react';
import './css/App.css';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import RightSidebar from './components/RightSidebar';
import 'boxicons/css/boxicons.min.css';

function App() {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const handleCourseSelect = (year: number, semester: string, course: string) => {
    const courseIdentifier = `${year} - ${semester} - ${course}`;
    setSelectedCourse(courseIdentifier);
  };

  return (
    <div className="app-container">
      <Sidebar onCourseSelect={handleCourseSelect} />
      <MainContent selectedCourse={selectedCourse} />
      <RightSidebar />
    </div>
  );
}

export default App;
