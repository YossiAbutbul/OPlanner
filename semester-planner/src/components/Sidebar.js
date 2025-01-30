import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { getAllYearsAndSemesters, initializeYear, addCourse, renameCourse, deleteCourse, deleteYear, } from "../utility/initializeDatabase";
import DeleteModal from "./DeleteModal";
const Sidebar = ({ onCourseOrSemesterSelect }) => {
    const [years, setYears] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [newCourseName, setNewCourseName] = useState("");
    const [contextMenu, setContextMenu] = useState(null);
    const [renameModal, setRenameModal] = useState(null);
    const [renameCourseName, setRenameCourseName] = useState("");
    const [isAddingYear, setIsAddingYear] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // New state for loading
    const [isLoadingAction, setIsLoadingAction] = useState(false); // New state for action loading
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [yearContextMenu, setYearContextMenu] = useState(null);
    const [adminPassword, setAdminPassword] = useState("");
    const [isDeletingYear, setIsDeletingYear] = useState(false);
    const [confirmDeleteYear, setConfirmDeleteYear] = useState(null);
    const contextMenuRef = useRef(null);
    const fetchYearsAndSemesters = async (preserveState = false) => {
        try {
            setIsLoading(true); // Start loading
            const existingYears = await getAllYearsAndSemesters();
            const formattedYears = existingYears.map((year) => {
                const existingYear = years.find((y) => y.year === year.year);
                return {
                    ...year,
                    expanded: preserveState ? existingYear?.expanded || false : false,
                    semesters: year.semesters.map((semester) => {
                        const existingSemester = existingYear?.semesters.find((s) => s.name === semester.name);
                        return {
                            ...semester,
                            expanded: preserveState ? existingSemester?.expanded || false : false,
                            courses: semester.courses || [],
                        };
                    }),
                };
            });
            setYears(formattedYears);
        }
        catch (error) {
            console.error("Error fetching years and semesters:", error);
        }
        finally {
            setIsLoading(false); // End loading
        }
    };
    useEffect(() => {
        fetchYearsAndSemesters();
    }, []);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu(null);
                setYearContextMenu(null); // Close year context menu as well
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const toggleExpand = (yearIndex, semesterIndex) => {
        setYears((prevYears) => prevYears.map((year, yIndex) => {
            if (yIndex === yearIndex) {
                return {
                    ...year,
                    expanded: semesterIndex === undefined ? !year.expanded : year.expanded,
                    semesters: year.semesters.map((semester, sIndex) => {
                        if (sIndex === semesterIndex) {
                            return { ...semester, expanded: !semester.expanded };
                        }
                        return semester; // Retain the state of other semesters
                    }),
                };
            }
            return year; // Retain the state of other years
        }));
    };
    const handleAddYear = async () => {
        let yearToAdd = new Date().getFullYear();
        while (true) {
            setIsAddingYear(true);
            const yearAdded = await initializeYear(yearToAdd);
            if (yearAdded) {
                await fetchYearsAndSemesters(true); // Preserve expanded state
                setIsAddingYear(false);
                break; // Successfully added a year, exit the loop
            }
            else {
                console.warn(`Year ${yearToAdd} already exists. Trying the next year.`);
                yearToAdd += 1; // Increment to the next year
            }
        }
    };
    const capitalizeWords = (str) => {
        return str.replace(/\b\w/g, char => char.toUpperCase());
    };
    const handleAddCourse = async () => {
        if (modalData && newCourseName.trim() !== "") {
            try {
                setIsLoadingAction(true); // Start loading
                const capitalizedCourseName = capitalizeWords(newCourseName.trim());
                await addCourse(modalData.year, modalData.semester, capitalizedCourseName);
                await fetchYearsAndSemesters(true); // Preserve expanded state
                setModalOpen(false);
                setNewCourseName("");
            }
            catch (error) {
                console.error("Error adding course:", error);
            }
            finally {
                setIsLoadingAction(false); // End loading
            }
        }
        else {
            alert("Please enter a valid course name.");
        }
    };
    const handleRenameCourse = async () => {
        if (renameModal && renameCourseName.trim() !== "") {
            try {
                setIsLoadingAction(true); // Start loading
                const capitalizedCourseName = capitalizeWords(renameCourseName.trim());
                await renameCourse(renameModal.year, renameModal.semester, renameModal.course, capitalizedCourseName);
                await fetchYearsAndSemesters(true); // Preserve expanded state
                setRenameModal(null);
                setRenameCourseName("");
            }
            catch (error) {
                console.error("Error renaming course:", error);
            }
            finally {
                setIsLoadingAction(false); // End loading
            }
        }
        else {
            alert("Please enter a valid course name.");
        }
    };
    const handleDeleteCourse = async (year, semester, course) => {
        setConfirmDelete({ year, semester, course });
    };
    const confirmDeleteCourse = async () => {
        if (confirmDelete) {
            try {
                setIsLoadingAction(true); // Start loading
                await deleteCourse(confirmDelete.year, confirmDelete.semester, confirmDelete.course);
                await fetchYearsAndSemesters(true); // Preserve expanded state
            }
            catch (error) {
                console.error("Error deleting course:", error);
            }
            finally {
                setIsLoadingAction(false); // End loading
                setConfirmDelete(null);
            }
        }
    };
    const openContextMenu = (e, year, semester, course) => {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        setContextMenu({
            year,
            semester,
            course,
            x: rect.right + 10,
            y: rect.top,
        });
    };
    const openYearContextMenu = (e, year) => {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        setYearContextMenu({
            year,
            x: rect.right + 10,
            y: rect.top,
        });
    };
    const handleDeleteYear = async (password = "") => {
        if (password.trim() === "admin") {
            try {
                setIsDeletingYear(true);
                if (confirmDeleteYear) {
                    await deleteYear(confirmDeleteYear.year);
                    await fetchYearsAndSemesters(true); // Preserve expanded state
                    setConfirmDeleteYear(null);
                    setAdminPassword(""); // Reset admin password
                }
            }
            catch (error) {
                console.error("Error deleting year:", error);
            }
            finally {
                setIsDeletingYear(false);
            }
        }
        else {
            alert("Invalid admin password.");
        }
    };
    useEffect(() => {
        if (renameModal) {
            setRenameCourseName(renameModal.course);
        }
    }, [renameModal]);
    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            handleAddCourse();
        }
    };
    return (_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "profile-section", children: [_jsx("img", { src: "./user-svgrepo-com.svg", alt: "Profile", className: "profile-pic" }), _jsxs("div", { className: "profile-header", children: [_jsx("label", { className: "profile-label", children: "OPlanner" }), _jsx("button", { className: "add-year-btn", onClick: handleAddYear, title: "Add Year", disabled: isAddingYear, children: isLoading ? _jsx("i", { className: "bx bx-loader-alt bx-spin" }) : isAddingYear ? _jsx("i", { className: "bx bx-loader-alt bx-spin" }) : _jsx("i", { className: "bx bx-plus" }) })] })] }), _jsx("ul", { className: "year-list", children: years.map((year, yearIndex) => (_jsxs("li", { className: `year-item ${year.expanded ? "expanded" : ""}`, onContextMenu: (e) => openYearContextMenu(e, year.year), children: [_jsxs("div", { className: "year-header", onClick: () => toggleExpand(yearIndex), children: [year.year, _jsx("i", { className: `bx ${year.expanded ? "bx-chevron-up" : "bx-chevron-down"} toggle-icon` })] }), year.expanded && (_jsx("ul", { className: "semester-list", children: year.semesters.map((semester, semesterIndex) => (_jsxs("li", { className: `semester-item ${semester.expanded ? "expanded" : ""}`, children: [_jsxs("div", { className: "semester-header", onClick: () => toggleExpand(yearIndex, semesterIndex), children: [semester.name, _jsx("i", { className: "bx bx-plus add-course-icon", onClick: (e) => {
                                                    e.stopPropagation();
                                                    setModalData({ year: year.year, semester: semester.name });
                                                    setModalOpen(true);
                                                }, title: "Add New Course" })] }), semester.expanded && (_jsx("ul", { className: "course-list", children: semester.courses.map((course) => (_jsxs("li", { className: "course-item", onClick: () => {
                                                console.log("Switching to course:", {
                                                    year: year.year,
                                                    semester: semester.name,
                                                    course: course.name,
                                                });
                                                onCourseOrSemesterSelect(year.year, semester.name, course.name);
                                            }, children: [capitalizeWords(course.name), _jsx("i", { className: "bx bx-dots-vertical-rounded context-menu-icon", onClick: (e) => {
                                                        e.stopPropagation();
                                                        openContextMenu(e, year.year, semester.name, course.name);
                                                    } })] }, course.name))) }))] }, semester.key))) }))] }, year.year))) }), isModalOpen && (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal-content", children: [_jsx("h2", { children: "Add New Course" }), _jsx("input", { type: "text", placeholder: "Enter Course Name", value: newCourseName, onChange: (e) => setNewCourseName(e.target.value), onKeyPress: handleKeyPress, disabled: isLoadingAction }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { className: "modal-btn", onClick: handleAddCourse, disabled: isLoadingAction, children: isLoadingAction ? _jsx("div", { className: "loading-spinner" }) : "Add Course" }), _jsx("button", { className: "modal-btn cancel-btn", onClick: () => setModalOpen(false), disabled: isLoadingAction, children: "Cancel" })] })] }) })), contextMenu && (_jsxs("div", { ref: contextMenuRef, className: "context-menu", style: { top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }, children: [_jsx("button", { onClick: () => {
                            setRenameModal({
                                year: contextMenu.year,
                                semester: contextMenu.semester,
                                course: contextMenu.course,
                            });
                            setContextMenu(null);
                        }, children: "Rename" }), _jsx("button", { onClick: () => {
                            handleDeleteCourse(contextMenu.year, contextMenu.semester, contextMenu.course);
                            setContextMenu(null);
                        }, children: "Delete" })] })), yearContextMenu && (_jsx("div", { ref: contextMenuRef, className: "context-menu", style: { top: `${yearContextMenu.y}px`, left: `${yearContextMenu.x}px` }, children: _jsx("button", { onClick: () => {
                        setConfirmDeleteYear({ year: yearContextMenu.year });
                        setYearContextMenu(null);
                    }, children: "Delete Year" }) })), renameModal && (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal-content", children: [_jsx("h2", { children: "Rename Course" }), _jsx("input", { type: "text", placeholder: "Enter New Course Name", value: renameCourseName, onChange: (e) => setRenameCourseName(e.target.value) }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { className: "modal-btn", onClick: handleRenameCourse, disabled: isLoadingAction, children: isLoadingAction ? _jsx("i", { className: "bx bx-loader-alt bx-spin" }) : "Rename" }), _jsx("button", { className: "modal-btn cancel-btn", onClick: () => setRenameModal(null), children: "Cancel" })] })] }) })), confirmDelete && (_jsx(DeleteModal, { isOpen: !!confirmDelete, onClose: () => setConfirmDelete(null), onConfirm: confirmDeleteCourse, title: "Confirm Delete", message: `Are you sure you want to delete "${confirmDelete.course}"?` })), confirmDeleteYear && (_jsxs(_Fragment, { children: [_jsx(DeleteModal, { isOpen: !!confirmDeleteYear, onClose: () => {
                            setConfirmDeleteYear(null);
                            setAdminPassword(""); // Reset admin password
                        }, onConfirm: handleDeleteYear, title: "Confirm Delete Year", message: `Enter admin password to delete year "${confirmDeleteYear.year}".` }), _jsxs("div", { className: "modal-content", children: [_jsx("input", { type: "password", placeholder: "Admin Password", value: adminPassword, onChange: (e) => setAdminPassword(e.target.value) }), isDeletingYear && _jsx("div", { className: "loading-spinner" })] })] }))] }));
};
export default Sidebar;
