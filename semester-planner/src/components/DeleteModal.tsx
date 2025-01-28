import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import "../css/DeleteModal.css"; // Use the new styles
import { FaEye, FaEyeSlash } from "react-icons/fa"; // Import eye icons

Modal.setAppElement("#root");

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (adminPassword?: string) => void;
  title: string;
  message: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility

  const handleConfirm = async () => {
    setIsLoading(true);
    await onConfirm(adminPassword);
    setIsLoading(false);
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && isOpen) {
        handleConfirm();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !event.target.closest(".ReactModal__Content")) {
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

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="ReactModal__Content"
      overlayClassName="ReactModal__Overlay"
      contentLabel={title}
    >
      <button className="close-btn" onClick={onClose}>&times;</button>
      <h2>{title}</h2>
      <p>{message}</p>
      {title === "Confirm Delete Year" && (
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Admin Password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <span
            className="eye-icon"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>
      )}
      <div className="modal-actions">
        <button
          type="button"
          onClick={handleConfirm}
          className="modal-btn confirm-btn"
          disabled={isLoading}
        >
          {isLoading ? <div className="loading-spinner"></div> : "Confirm"}
        </button>
        <button type="button" className="modal-btn cancel-btn" onClick={onClose} disabled={isLoading}>
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default DeleteModal;
