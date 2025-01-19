import React from "react";
import { useHomework } from "../context/HomeworkContext";

const NotificationList: React.FC = () => {
  const { notifications } = useHomework();

  return (
    <div className="notification-list">
      {notifications.length === 0 ? (
        <p>No upcoming homework due.</p>
      ) : (
        <ul>
          {notifications.map((notification, index) => (
            <li key={index}>{notification}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationList;
