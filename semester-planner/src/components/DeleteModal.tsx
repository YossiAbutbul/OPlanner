import React from "react";
import Modal from "react-modal";
import "../css/DeleteModal.css"; // Use the new styles

Modal.setAppElement("#root");

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
      <div className="modal-actions">
        <button type="button" onClick={onConfirm} className="modal-btn confirm-btn">
          Confirm
        </button>
        <button type="button" className="modal-btn cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default DeleteModal;
