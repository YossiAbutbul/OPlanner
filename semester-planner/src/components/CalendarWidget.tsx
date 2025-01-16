import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';  // Ensure this is styled correctly
import '../css/CalendarWidget.css';          

const CalendarWidget: React.FC = () => {
  const [value, setValue] = useState(new Date());

  return (
    <div className="calendar-widget">
      <h2>Select a Date</h2>
        <Calendar onChange={setValue} value={value} />
      <p>Selected Date: {value.toDateString()}</p>
    </div>
  );
};

export default CalendarWidget;
