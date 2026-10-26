import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { SPRING_DEFAULT, SPRING_SHEET, project } from "../utility/motion";
import "../css/Modal.css";

const SHEET_QUERY = "(max-width: 480px)";

// Phones get a bottom sheet; track the breakpoint so the motion matches.
const useIsSheet = () => {
  const [isSheet, setIsSheet] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(SHEET_QUERY);
    const handle = (e: MediaQueryListEvent) => setIsSheet(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  return isSheet;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlay = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  // Element that had focus before modal opened — restored on close so the
  // user lands back on their trigger button instead of <body>.
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Escape closes, Tab traps focus inside the modal.
  useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element inside the modal (skip the close
    // button if there's anything else interactive — close button focus on
    // open is jarring).
    requestAnimationFrame(() => {
      const root = modalRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusables.length > 1 ? focusables[1] : focusables[0];
      first?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute("data-focus-skip"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger that opened the modal.
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  // Close only when both mousedown AND click happen on the overlay (not when
  // a text selection drag started inside the modal and released on overlay).
  const downOnOverlayRef = useRef(false);
  const isSheet = useIsSheet();
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  // Swipe-to-dismiss: decide from where the flick would come to rest, not
  // from where the finger let go, so a short fast flick still closes.
  const onSheetDragEnd = (_: unknown, info: PanInfo) => {
    const height = modalRef.current?.offsetHeight ?? 400;
    const restingY = info.offset.y + project(info.velocity.y);
    if (restingY > height * 0.5) onClose();
  };

  const panel = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isSheet
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : {
          initial: { opacity: 0, scale: 0.94, y: 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 6 },
        };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
    <motion.div
      key="overlay"
      className="app-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
      <motion.div
        ref={modalRef}
        className="app-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        {...panel}
        transition={isSheet ? SPRING_SHEET : SPRING_DEFAULT}
        // Sheet tracks the finger 1:1 downward and rubber-bands upward. Only
        // the header starts a drag, so the body still scrolls normally.
        drag={isSheet && !reduceMotion ? "y" : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.06, bottom: 1 }}
        dragMomentum={false}
        onDragEnd={onSheetDragEnd}
      >
        {/* Header wraps title + close so they stick together at the top of
            the sheet on mobile (where the body scrolls). Empty title still
            renders the bar so the close button is always present. */}
        <div
          className="app-modal-header"
          onPointerDown={(e) => {
            if (isSheet && !(e.target as HTMLElement).closest("button")) dragControls.start(e);
          }}
        >
          {isSheet && <span className="app-modal-grabber" aria-hidden />}
          {title ? <h3 className="app-modal-title">{title}</h3> : <span />}
          <button
            className="app-modal-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>
        <div className="app-modal-body">{children}</div>
        {footer && <div className="app-modal-actions">{footer}</div>}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
