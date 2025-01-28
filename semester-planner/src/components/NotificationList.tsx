import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import "../css/NotificationList.css";

const NotificationList: React.FC = () => {
  const { notifications, homework, addHomework } = useHomework();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editHomework, setEditHomework] = useState<{
    id: string;
    name: string;
    dueDate: string;
    status: string;
    year: number;
    semester: string;
    course: string;
  } | null>(null);

  // Get notification styling class
  const getNotificationClass = (daysLeft: number) => {
    if (daysLeft === 0 || daysLeft < 3) {
      return "urgent"; // Red border
    } else if (daysLeft < 7) {
      return "near-due"; // Orange border
    } else {
      return "distant"; // Green border
    }
  };

  // Get styling for days text
  const getDayStyle = (daysLeft: number) => {
    if (daysLeft === 0 || daysLeft < 3) {
      return { color: "#ff4c4c", fontWeight: "bold" }; // Bold red
    } else if (daysLeft < 7) {
      return { color: "orange", fontWeight: "bold" }; // Orange
    } else {
      return { color: "#2ECC71", fontWeight: "bold" }; // Green
    }
  };

  // Capitalize the first letter of the task name
  const capitalizeFirstLetter = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Handle notification click
  const handleNotificationClick = (id: string) => {
    const selectedHomework = homework.find((hw) => hw.id === id);
    if (selectedHomework) {
      setEditHomework(selectedHomework);
      setModalOpen(true);
    } else {
      console.error(`Homework with ID ${id} not found.`);
    }
  };

  const handleSave = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string,
    year: number,
    semester: string,
    course: string
  ) => {
    await addHomework(id, name, dueDate, status, year, semester, course); // Save the updated data
    setModalOpen(false); // Close modal after saving
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditHomework(null);
  };

  return (
    <div className="notification-list">
      {notifications.length === 0 ? (
        <p>No upcoming deadlines yet!</p>
      ) : (
        <ul>
          {notifications.map(({ id, message }) => {
            const match = message.match(/(\d+) day/);
            const daysLeft = match ? parseInt(match[1], 10) : 0; // Default to 0 if no match

            if (daysLeft !== null) {
              const [taskName] = message.split(" is due");
              return (
                <li
                  key={id}
                  onClick={() => handleNotificationClick(id)}
                  className={`notification-item ${getNotificationClass(daysLeft)}`}>
                  <strong>{capitalizeFirstLetter(taskName.trim())}</strong> is due{" "}
                  <span style={getDayStyle(daysLeft)}>
                    {daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
                  </span>
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
        onSave={handleSave}
        editHomework={editHomework}
        selectedCourseData={null} // Not needed when editing
        isLoading={false} // Add the isLoading property
      />
    </div>
  );
};

export default NotificationList;
