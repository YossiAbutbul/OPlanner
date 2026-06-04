import React from "react";
import Modal from "./Modal";
import CustomSelect from "./CustomSelect";
import { useNotifications } from "../context/NotificationContext";
import "../css/ReminderSettings.css";

interface ReminderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEAD_OPTIONS = [5, 10, 15, 30, 60];

const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    setEnabled,
    setLeadMinutes,
    permission,
    requestPermission,
    supported,
    isDesktop,
  } = useNotifications();

  const status: { label: string; tone: "ok" | "warn" | "off" } = !supported
    ? { label: "Not supported in this browser", tone: "off" }
    : !isDesktop
      ? { label: "Desktop only — reminders are off on this device", tone: "off" }
      : permission === "granted"
        ? { label: "Notifications allowed", tone: "ok" }
        : permission === "denied"
          ? { label: "Blocked — enable notifications in your browser settings", tone: "warn" }
          : { label: "Your browser will ask you to allow this once", tone: "warn" };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reminders"
      footer={
        <button type="button" className="app-modal-btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="rsx">
        <p>Popup notifications for upcoming exams and tasks while OPlanner is open.</p>

        <label className="hw-ignore-overdue">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable desktop reminders</span>
        </label>

        <label htmlFor="rsx-lead">Remind before a task starts</label>
        <CustomSelect
          id="rsx-lead"
          value={String(settings.leadMinutes)}
          onChange={(v) => setLeadMinutes(Number(v))}
          options={LEAD_OPTIONS.map((m) => ({ value: String(m), label: `${m} min before` }))}
        />

        <div className={`rsx-status rsx-status-${status.tone}`}>
          <span>{status.label}</span>
          {supported && isDesktop && permission === "default" && (
            <button type="button" className="rsx-allow" onClick={() => void requestPermission()}>
              Allow in browser…
            </button>
          )}
        </div>

        <p className="rsx-note">
          Exams and tasks remind you the day before they're due, and tasks remind you again
          shortly before they start.
        </p>
      </div>
    </Modal>
  );
};

export default ReminderSettingsModal;
