import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import "../css/HomeworkModal.css"; // Ensure your styles are correctly imported
Modal.setAppElement("#root");
const HomeworkModal = ({ isOpen, onClose, onSave, editHomework, selectedCourseData, isLoading, }) => {
    const [name, setName] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [status, setStatus] = useState("PENDING");
    const dateInputRef = useRef(null);
    useEffect(() => {
        if (editHomework) {
            setName(editHomework.name);
            setDueDate(editHomework.dueDate);
            setStatus(editHomework.status);
        }
        else {
            setName("");
            setDueDate("");
            setStatus("PENDING");
        }
    }, [editHomework]);
    const handleSave = () => {
        const courseData = editHomework || selectedCourseData;
        if (!courseData) {
            alert("Please select a valid course to add or edit homework.");
            return;
        }
        const { year, semester, course = "" } = courseData;
        if (!name.trim()) {
            alert("Please enter a valid name for the homework.");
            return;
        }
        if (!dueDate) {
            alert("Please select a valid due date for the homework.");
            return;
        }
        onSave(editHomework?.id || null, name.trim(), dueDate, status, year, semester, course);
        setName("");
        setDueDate("");
        setStatus("PENDING");
        onClose();
    };
    const handleDateClick = () => {
        dateInputRef.current?.showPicker();
    };
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Enter" && isOpen) {
                e.preventDefault();
                handleSave();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, name, dueDate, status, selectedCourseData, editHomework]);
    return (_jsxs(Modal, { isOpen: isOpen, onRequestClose: onClose, className: "ReactModal__Content", overlayClassName: "ReactModal__Overlay", contentLabel: editHomework ? "Edit Homework" : "Add Homework", children: [_jsx("button", { className: "close-btn", onClick: onClose, children: "\u00D7" }), _jsx("h2", { children: editHomework ? "Edit Homework" : "Add Homework" }), _jsxs("form", { children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "homework-name", children: "Name:" }), _jsx("input", { id: "homework-name", type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "Enter homework name", autoComplete: "off" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "due-date", children: "Due Date:" }), _jsx("div", { className: "date-input-container", onClick: handleDateClick, style: { cursor: "pointer" }, children: _jsx("input", { id: "due-date", type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), ref: dateInputRef }) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "status", children: "Status:" }), _jsxs("select", { id: "status", value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "PENDING", children: "PENDING" }), _jsx("option", { value: "COMPLETED", children: "COMPLETED" })] })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", onClick: handleSave, disabled: !name.trim() || !dueDate || !(selectedCourseData || editHomework) || isLoading, children: isLoading ? _jsx("i", { className: "bx bx-loader-alt bx-spin" }) : "Save" }), _jsx("button", { type: "button", className: "cancel-btn", onClick: onClose, children: "Cancel" })] })] })] }));
};
export default HomeworkModal;
