import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import "../css/MainContent.css";
import { useHomework } from "../context/HomeworkContext";
const MainContent = ({ selectedCourseData }) => {
    const { homework, fetchHomework, addHomework } = useHomework();
    const [filteredHomework, setFilteredHomework] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [isLoadingAction, setIsLoadingAction] = useState(false); // New state for action loading
    // Fetch homework whenever the selected course changes
    useEffect(() => {
        if (selectedCourseData) {
            const { year, semester, course } = selectedCourseData;
            if (course) {
                fetchHomework(year, semester, course);
            }
        }
    }, [selectedCourseData, fetchHomework]);
    // Filter homework for the selected course
    useEffect(() => {
        if (selectedCourseData) {
            const { course } = selectedCourseData;
            setFilteredHomework(homework.filter((hw) => hw.course === course));
        }
        else {
            setFilteredHomework([]);
        }
    }, [selectedCourseData, homework]);
    const capitalizeWords = (str) => {
        return str.replace(/\b\w/g, char => char.toUpperCase());
    };
    // Handle saving new homework or updating existing homework
    const handleSaveHomework = async (id, name, dueDate, status) => {
        if (!selectedCourseData) {
            alert("Please select a valid course.");
            return;
        }
        const { year, semester, course } = selectedCourseData;
        const capitalizedCourse = course ? capitalizeWords(course) : "";
        try {
            setIsLoadingAction(true); // Start loading
            await addHomework(id, name, dueDate, status, year, semester, capitalizedCourse);
            await fetchHomework(year, semester, capitalizedCourse); // Refresh homework list after saving
            setModalOpen(false); // Close the modal after saving
        }
        catch (error) {
            console.error("Error saving homework:", error);
        }
        finally {
            setIsLoadingAction(false); // End loading
        }
    };
    return (_jsxs("div", { className: "main-layout", children: [_jsx("div", { className: "main-content", children: selectedCourseData ? (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Course Progress" }), _jsxs("h2", { children: ["Progress for ", capitalizeWords(selectedCourseData.course ?? ""), " in", " ", selectedCourseData.semester, ", ", selectedCourseData.year] }), _jsx("div", { className: "progress-chart-container", children: _jsx(ProgressChart, { completed: filteredHomework.filter((hw) => hw.status === "COMPLETED").length, pending: filteredHomework.filter((hw) => hw.status === "PENDING").length }) }), _jsx("div", { className: "homework-table-container", children: _jsx(HomeworkTable, { tasks: filteredHomework, onAddTask: () => setModalOpen(true) }) })] })) : (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Course Progress" }), _jsx("p", { children: "Please select a course from the sidebar to view its progress." })] })) }), _jsx(HomeworkModal, { isOpen: isModalOpen, onClose: () => setModalOpen(false), onSave: handleSaveHomework, selectedCourseData: selectedCourseData, isLoading: isLoadingAction })] }));
};
export default MainContent;
