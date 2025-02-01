import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import "../css/NotificationList.css";
const NotificationList = () => {
    const { notifications, homework, addHomework } = useHomework();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editHomework, setEditHomework] = useState(null);
    // Get notification styling class
    const getNotificationClass = (daysLeft) => {
        if (daysLeft === 0 || daysLeft < 3) {
            return "urgent"; // Red border
        }
        else if (daysLeft < 7) {
            return "near-due"; // Orange border
        }
        else {
            return "distant"; // Green border
        }
    };
    // Get styling for days text
    const getDayStyle = (daysLeft) => {
        if (daysLeft === 0 || daysLeft < 3) {
            return { color: "#ff4c4c", fontWeight: "bold" }; // Bold red
        }
        else if (daysLeft < 7) {
            return { color: "orange", fontWeight: "bold" }; // Orange
        }
        else {
            return { color: "#2ECC71", fontWeight: "bold" }; // Green
        }
    };
    // Capitalize the first letter of the task name
    const capitalizeFirstLetter = (text) => {
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
    // Handle notification click
    const handleNotificationClick = (id) => {
        const selectedHomework = homework.find((hw) => hw.id === id);
        if (selectedHomework) {
            setEditHomework(selectedHomework);
            setModalOpen(true);
        }
        else {
            console.error(`Homework with ID ${id} not found.`);
        }
    };
    const handleSave = async (id, name, dueDate, status, year, semester, course) => {
        await addHomework(id, name, dueDate, status, year, semester, course); // Save the updated data
        setModalOpen(false); // Close modal after saving
    };
    const handleModalClose = () => {
        setModalOpen(false);
        setEditHomework(null);
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of the day
    return (_jsxs("div", { className: "notification-list", children: [notifications.length === 0 ? (_jsx("p", { children: "No upcoming deadlines yet!" })) : (_jsx("ul", { children: notifications.map(({ id, message }) => {
                    const match = message.match(/(\d+) day/);
                    const daysLeft = match ? parseInt(match[1], 10) : 0; // Default to 0 if no match
                    const selectedHomework = homework.find((hw) => hw.id === id);
                    if (selectedHomework) {
                        const dueDate = new Date(selectedHomework.dueDate);
                        if (dueDate < today) {
                            return null; // Skip tasks with due dates before today
                        }
                    }
                    if (daysLeft !== null) {
                        const taskName = message.split(" is due")[0].replace(" is overdue!", "").trim(); // Ensure correct task name
                        return (_jsxs("li", { onClick: () => handleNotificationClick(id), className: `notification-item ${getNotificationClass(daysLeft)}`, children: [_jsx("strong", { children: capitalizeFirstLetter(taskName) }), " is due", " ", _jsx("span", { style: getDayStyle(daysLeft), children: daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""}` })] }, id));
                    }
                    return null; // Skip invalid notifications
                }) })), _jsx(HomeworkModal, { isOpen: isModalOpen, onClose: handleModalClose, onSave: handleSave, editHomework: editHomework, selectedCourseData: null, isLoading: false })] }));
};
export default NotificationList;
