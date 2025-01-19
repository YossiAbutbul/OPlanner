import React from "react";
import { useHomework } from "../context/HomeworkContext";
import "../css/NotificationList.css";

const NotificationList: React.FC = () => {
  const { notifications } = useHomework();

  const getDayStyle = (daysLeft: number) => {
    if (daysLeft === 0) {
      return { color: "#ff4c4c", fontWeight: "bold" }; // Today: Bold red
    } else if (daysLeft < 3) {
      return { color: "#ff4c4c" }; // Urgent: Red
    } else if (daysLeft < 7) {
      return { color: "orange" }; // Near-due: Orange
    } else {
      return { color: "#2ECC71" }; // Distant: Green
    }
  };

  return (
    <div className="notification-list">
      {notifications.length === 0 ? (
        <p>No upcoming homework due.</p>
      ) : (
        <ul>
          {notifications.map((notification, index) => {
            // Extract name and due date from the notification text
            const match = notification.match(/"(.+?)" is due in (\d+) day/);
            const name = match ? match[1] : "Unknown";
            const daysLeft = match ? parseInt(match[2], 10) : null;

            // Handle "due today" case
            if (daysLeft === 0) {
              return (
                <li key={index} style={{ color: "red", fontWeight: "bold" }}>
                  <strong>{name}</strong> is due today.
                </li>
              );
            }

            // Display notifications for other cases
            if (daysLeft !== null) {
              return (
                <li key={index}>
                  <strong>{name}</strong>&nbsp;is due in&nbsp;
                  <span style={{ ...getDayStyle(daysLeft), fontWeight: "bold" }}>
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </span>.
                </li>
              );
            }

            // Skip invalid notifications
            return null;
          })}
        </ul>
      )}
    </div>
  );
};

export default NotificationList;
