import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import "../css/Modal.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlay = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="app-modal-overlay"
      onClick={() => closeOnOverlay && onClose()}
    >
      <div
        className="app-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="app-modal-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        {title && <h3 className="app-modal-title">{title}</h3>}
        <div className="app-modal-body">{children}</div>
        {footer && <div className="app-modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
