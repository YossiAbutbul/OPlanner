import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import Modal from "react-modal";
import "../css/DeleteModal.css"; // Use the new styles
import { FaEye, FaEyeSlash } from "react-icons/fa"; // Import eye icons
Modal.setAppElement("#root");
const DeleteModal = ({ isOpen, onClose, onConfirm, title, message, }) => {
    const [adminPassword, setAdminPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility
    const handleConfirm = async () => {
        setIsLoading(true);
        await onConfirm(adminPassword);
        setIsLoading(false);
    };
    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.key === "Enter" && isOpen) {
                handleConfirm();
            }
        };
        const handleClickOutside = (event) => {
            if (event.target instanceof Element && !event.target.closest(".ReactModal__Content")) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyPress);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("keydown", handleKeyPress);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);
    return (_jsxs(Modal, { isOpen: isOpen, onRequestClose: onClose, className: "ReactModal__Content", overlayClassName: "ReactModal__Overlay", contentLabel: title, children: [_jsx("button", { className: "close-btn", onClick: onClose, children: "\u00D7" }), _jsx("h2", { children: title }), _jsx("p", { children: message }), title === "Confirm Delete Year" && (_jsxs("div", { style: { position: "relative" }, children: [_jsx("input", { type: showPassword ? "text" : "password", placeholder: "Admin Password", value: adminPassword, onChange: (e) => setAdminPassword(e.target.value) }), _jsx("span", { className: "eye-icon", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(FaEyeSlash, {}) : _jsx(FaEye, {}) })] })), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", onClick: handleConfirm, className: "modal-btn confirm-btn", disabled: isLoading, children: isLoading ? _jsx("div", { className: "loading-spinner" }) : "Confirm" }), _jsx("button", { type: "button", className: "modal-btn cancel-btn", onClick: onClose, disabled: isLoading, children: "Cancel" })] })] }));
};
export default DeleteModal;
