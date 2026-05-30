import React, { useEffect, useState } from "react";
import Modal from "./Modal";

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsLoading(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsLoading(true);
    await onConfirm();
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            className="app-modal-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-danger"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="delete-modal-loading">
                <span className="delete-modal-spinner" />
                Deleting…
              </span>
            ) : (
              "Delete"
            )}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
};

export default DeleteModal;
