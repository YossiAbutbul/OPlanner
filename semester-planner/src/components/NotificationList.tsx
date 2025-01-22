import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import "../css/NotificationList.css";

const NotificationList: React.FC = () => {
  const { notifications, homework, addHomework } = useHomework(); // Import addHomework
  const [isModalOpen, setModalOpen] = useState(false);
  const [editHomework, setEditHomework] = useState<{
    id: string;
    name: string;
    dueDate: string;
    status: string;
  } | null>(null);

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

  const handleNotificationClick = (homeworkName: string) => {
    const selectedHomework = homework.find((hw) => hw.name === homeworkName);
    if (selectedHomework) {
      setEditHomework(selectedHomework);
      setModalOpen(true);
    }
  };

  const handleSave = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    await addHomework(id, name, dueDate, status); // Save the updated data
    setModalOpen(false); // Close modal after saving
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditHomework(null);
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

            if (daysLeft !== null) {
              return (
                <li
                  key={index}
                  onClick={() => handleNotificationClick(name)}
                  className="notification-item"
                >
                  {daysLeft === 0 ? (
                    <span style={{ color: "red", fontWeight: "bold" }}>
                      <strong>{name}</strong> is due today.
                    </span>
                  ) : (
                    <>
                      <strong>{name}</strong>&nbsp;is due in&nbsp;
                      <span
                        style={{ ...getDayStyle(daysLeft), fontWeight: "bold" }}
                      >
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                      </span>.
                    </>
                  )}
                </li>
              );
            }

            return null; // Skip invalid notifications
          })}
        </ul>
      )}

      {/* Homework Modal */}
      <HomeworkModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave} // Correctly pass handleSave
        editHomework={editHomework}
      />
    </div>
  );
};

export default NotificationList;
