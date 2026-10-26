import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useToast } from "../context/ToastContext";
import { SPRING_DEFAULT, project } from "../utility/motion";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

// Mirrors the TTL logic in ToastContext so the progress-bar countdown
// stays in sync with auto-dismiss timing.
const ttlFor = (kind: keyof typeof ICONS) =>
  kind === "error" ? 6000 : 4500;

const ToastList: React.FC = () => {
  const { toasts, dismiss } = useToast();
  const reduceMotion = useReducedMotion();

  // Flick sideways to dismiss: judged on where the flick would land.
  const onDragEnd = (id: string) => (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const width = (e.target as HTMLElement | null)?.closest?.(".toast")?.clientWidth ?? 320;
    if (Math.abs(info.offset.x + project(info.velocity.x)) > width / 2) dismiss(id);
  };

  return createPortal(
    <div className="toast-stack" role="region" aria-label="Notifications">
      <AnimatePresence initial={false}>
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <motion.div
            key={t.id}
            layout={!reduceMotion}
            className={`toast toast-${t.kind}${t.sticky ? " toast-sticky" : ""}`}
            role={t.kind === "error" ? "alert" : "status"}
            style={{ ["--toast-ttl" as string]: `${ttlFor(t.kind)}ms` }}
            // Rises in from the corner and leaves the way it came.
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            transition={SPRING_DEFAULT}
            drag={reduceMotion ? false : "x"}
            dragSnapToOrigin
            dragElastic={0.6}
            onDragEnd={onDragEnd(t.id)}
          >
            <span className="toast-icon">
              <Icon size={18} strokeWidth={2.4} />
            </span>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </motion.div>
        );
      })}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default ToastList;
