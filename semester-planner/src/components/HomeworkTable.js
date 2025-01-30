import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import DeleteModal from "./DeleteModal";
import "../css/HomeworkTable.css";
import "boxicons/css/boxicons.min.css";
const HomeworkTable = ({ tasks, onAddTask }) => {
    const { removeHomework, addHomework } = useHomework();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editHomework, setEditHomework] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    // Handle task deletion
    const handleDelete = (homework) => {
        setConfirmDelete(homework);
    };
    const confirmDeleteTask = async () => {
        if (confirmDelete) {
            const { id, year, semester, course } = confirmDelete;
            try {
                await removeHomework(id, year, semester, course);
                console.log(`Task "${confirmDelete.name}" deleted successfully.`);
            }
            catch (error) {
                console.error("Error deleting homework:", error);
            }
            finally {
                setConfirmDelete(null);
            }
        }
    };
    // Handle task editing
    const handleEditClick = (homework) => {
        setEditHomework(homework); // Set the homework for editing
        setModalOpen(true);
    };
    // Capitalize the first letter of the homework name
    const capitalizeFirstLetter = (text) => {
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
    // Get style for status
    const getStatusStyle = (status) => {
        const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        const isSmallScreen = window.innerWidth <= 1430;
        return capitalizedStatus === "Completed"
            ? { color: "#00bb77", fontWeight: "bold", backgroundColor: "#e6f7f1", padding: "5px 10px", borderRadius: "10px", display: "inline-block", transform: isSmallScreen ? "translateY(150%)" : "translateY(80%)" }
            : { color: "#ffbf00", fontWeight: "bold", backgroundColor: "#fff7e6", padding: "5px 10px", borderRadius: "10px", display: "inline-block", transform: isSmallScreen ? "translateY(150%)" : "translateY(80%)" };
    };
    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-GB");
    };
    // Sort homework for display
    const sortedHomework = [...tasks].sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING")
            return -1;
        if (a.status !== "PENDING" && b.status === "PENDING")
            return 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    return (_jsxs("div", { children: [_jsxs("div", { className: "header-row", children: [_jsx("h2", { children: "Tasks List" }), _jsxs("button", { className: "add-homework-btn", onClick: onAddTask, children: [_jsx("i", { className: "bx bx-plus" }), " Add Task"] })] }), sortedHomework.length === 0 ? (_jsx("p", { children: "No tasks available. Click \"Add Task\" to get started!" })) : (_jsxs("table", { className: "homework-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Assignment" }), _jsx("th", { children: "Due Date" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: sortedHomework.map((entry) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("i", { className: "bx bx-edit" }), " ", capitalizeFirstLetter(entry.name)] }), _jsxs("td", { children: [_jsx("i", { className: "bx bx-calendar-alt" }), " ", formatDate(entry.dueDate)] }), _jsx("td", { style: getStatusStyle(entry.status), children: entry.status.charAt(0).toUpperCase() + entry.status.slice(1).toLowerCase() }), _jsxs("td", { children: [_jsx("button", { onClick: () => handleEditClick(entry), children: "Edit" }), _jsx("button", { onClick: () => handleDelete(entry), children: "Delete" })] })] }, `${entry.id}-${entry.dueDate}`))) })] })), confirmDelete && (_jsx(DeleteModal, { isOpen: !!confirmDelete, onClose: () => setConfirmDelete(null), onConfirm: confirmDeleteTask, title: "Confirm Delete", message: `Are you sure you want to delete this homework: "${confirmDelete.name}"?` })), _jsx(HomeworkModal, { isOpen: isModalOpen, onClose: () => {
                    setModalOpen(false);
                    setEditHomework(null);
                }, onSave: (id, name, dueDate, status, year, semester, course) => {
                    if (!name || !dueDate) {
                        alert("Please fill in all fields before saving.");
                        return;
                    }
                    addHomework(id, name, dueDate, status, year, semester, course);
                    setModalOpen(false);
                    setEditHomework(null);
                }, editHomework: editHomework, selectedCourseData: editHomework ? null : null, isLoading: false })] }));
};
export default HomeworkTable;
