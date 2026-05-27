import React, { useEffect, useRef } from "react";
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

  // Close only when both mousedown AND click happen on the overlay (not when
  // a text selection drag started inside the modal and released on overlay).
  const downOnOverlayRef = useRef(false);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="app-modal-overlay"
      onMouseDown={(e) => {
        downOnOverlayRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (closeOnOverlay && downOnOverlayRef.current && e.target === e.currentTarget) {
          onClose();
        }
        downOnOverlayRef.current = false;
      }}
    >
      <div
        className="app-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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
