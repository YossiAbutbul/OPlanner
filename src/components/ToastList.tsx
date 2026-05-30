import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToast } from "../context/ToastContext";

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
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
            style={{ ["--toast-ttl" as string]: `${ttlFor(t.kind)}ms` }}
          >
            <span className="toast-icon">
              <Icon size={18} strokeWidth={2.4} />
            </span>
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default ToastList;
