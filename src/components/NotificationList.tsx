import React, { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useToast } from "../context/ToastContext";
import { timeLeft } from "../utility/dayCalendar";
import HomeworkModal from "./HomeworkModal";
import { BellOff } from "lucide-react";
import "../css/NotificationList.css";

const NotificationList: React.FC = () => {
  const { notifications, homework, addHomework } = useHomework();
  const toast = useToast();
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
    course: string,
    ignoreOverdue?: boolean,
    startTime?: string,
    endTime?: string,
    notes?: string,
    color?: string
  ) => {
    await addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue, undefined, startTime, endTime, notes, color);
    toast.success(id ? `Task “${name}” updated` : `Task “${name}” added`);
    setModalOpen(false);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditHomework(null);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of the day

  return (
    <div className="notification-list">
      {notifications.length === 0 ? (
        <div className="nl-empty">
          <span className="nl-empty-badge">
            <BellOff size={20} strokeWidth={1.6} />
          </span>
          <p className="nl-empty-title">You're all clear</p>
          <p className="nl-empty-text">No upcoming deadlines.</p>
        </div>
      ) : (
        <ul>
          {notifications.map(({ id }) => {
            const entry = homework.find((hw) => hw.id === id);
            if (!entry) return null;
            // Skip tasks already past due (shown elsewhere as overdue).
            if (new Date(entry.dueDate) < today) return null;

            // Same-day tasks with a time read in hours; otherwise days.
            const tl = timeLeft(entry.dueDate, entry.endTime ?? entry.startTime);
            return (
              <li
                key={id}
                onClick={() => handleNotificationClick(id)}
                className={`notification-item ${getNotificationClass(tl.days)}`}>
                <strong>{capitalizeFirstLetter(entry.name)}</strong> is due{" "}
                <span style={getDayStyle(tl.days)}>{tl.short}</span>
              </li>
            );
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
