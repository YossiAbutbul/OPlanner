import React from 'react';
import './css/App.css';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent.tsx';
import RightSidebar from './components/RightSidebar.tsx';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <MainContent />
      <RightSidebar />
    </div>
  );
}

export default App;
