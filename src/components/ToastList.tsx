import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToast } from "../context/ToastContext";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

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
          >
            <Icon size={18} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default ToastList;
