import React from 'react';
import ProgressChart from './ProgressChart';
import CalendarWidget from './CalendarWidget';
import HomeworkTable from './HomeworkTable';

function MainContent() {
return (
    <main className="main-content">
      <h1>Semester Overview</h1>
      <div className="progress-charts">
        <div className="pie-chart">
          <ProgressChart completed={15} total={30} />
        </div>
        <div className="pie-chart">
          <ProgressChart completed={8} total={20} />
        </div>
      </div>
      <CalendarWidget />
      <HomeworkTable />
    </main>
  );
}

export default MainContent;
