import React from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../css/CalendarWidget.css"; // Custom styles for width adjustment

interface CalendarWidgetProps {
  value: Date | null;
  onChange: (date: Date | Date[]) => void;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ value, onChange }) => {
  return (
    <div className="calendar-container">
      <Calendar value={value} onChange={onChange} />
    </div>
  );
};

export default CalendarWidget;
