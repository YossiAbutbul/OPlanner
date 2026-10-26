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
    installed,
    pushAvailable,
    pushSubscribed,
    pushError,
  } = useNotifications();

  // Installed app: Web Push, works while closed. Browser tab: desktop-only
  // in-app popups while the tab is open.
  const usable = pushAvailable || (supported && isDesktop);

  const status: { label: string; tone: "ok" | "warn" | "off" } = !supported
    ? { label: "Not supported in this browser", tone: "off" }
    : installed && !pushAvailable
      ? { label: "This device can't receive background reminders", tone: "off" }
      : !usable
        ? { label: "Install OPlanner to your home screen to get reminders", tone: "off" }
        : permission === "denied"
          ? { label: "Blocked — enable notifications in your settings", tone: "warn" }
          : permission === "default"
            ? { label: "Allow notifications to get reminders", tone: "warn" }
            : !pushAvailable
              ? { label: "Notifications allowed", tone: "ok" }
              : pushError
                ? { label: "Couldn't register this device — reopen the app to retry", tone: "warn" }
                : settings.enabled && pushSubscribed
                  ? { label: "On — reminders arrive even when OPlanner is closed", tone: "ok" }
                  : { label: "Notifications allowed", tone: "ok" };

  // Turning reminders on is a user gesture — the only moment iOS lets us ask
  // for notification permission.
  const handleToggle = (enabled: boolean) => {
    setEnabled(enabled);
    if (enabled && usable && permission === "default") void requestPermission();
  };

  // Lead-time picker is meaningless when reminders are switched off — dim it.
  const leadDisabled = !settings.enabled;

  const statusIcon =
    status.tone === "ok" ? (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : status.tone === "warn" ? (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="7" x2="12.01" y2="7" />
      </svg>
    );

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
        {/* Hero: ringing bell badge + one-line purpose. */}
        <div className="rsx-hero">
          <span className="rsx-hero-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <p className="rsx-hero-text">
            {pushAvailable
              ? "Notifications for upcoming exams and tasks, even when OPlanner is closed."
              : "Popup notifications for upcoming exams and tasks while OPlanner is open."}
          </p>
        </div>

        {/* Settings card: enable switch on top, lead-time below a divider. */}
        <div className="rsx-card">
          <label className="rsx-row rsx-switch-row">
            <span className="rsx-row-text">
              <span className="rsx-row-title">
                {pushAvailable ? "Enable reminders" : "Enable desktop reminders"}
              </span>
              <span className="rsx-row-sub">Show a popup when something is coming up.</span>
            </span>
            <span className="rsx-switch">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <span className="rsx-switch-track" aria-hidden="true">
                <span className="rsx-switch-thumb" />
              </span>
            </span>
          </label>

          <div className={`rsx-row rsx-lead-row${leadDisabled ? " is-disabled" : ""}`}>
            <span className="rsx-row-text">
              <span className="rsx-row-title">Remind before a task starts</span>
              <span className="rsx-row-sub">How early the second nudge fires.</span>
            </span>
            <div className="rsx-lead-select">
              <CustomSelect
                id="rsx-lead"
                disabled={leadDisabled}
                value={String(settings.leadMinutes)}
                onChange={(v) => setLeadMinutes(Number(v))}
                options={LEAD_OPTIONS.map((m) => ({ value: String(m), label: `${m} min before` }))}
              />
            </div>
          </div>
        </div>

        {/* Permission status banner. */}
        <div className={`rsx-status rsx-status-${status.tone}`}>
          <span className="rsx-status-icon" aria-hidden="true">{statusIcon}</span>
          <span className="rsx-status-label">{status.label}</span>
          {usable && permission === "default" && (
            <button type="button" className="rsx-allow" onClick={() => void requestPermission()}>
              Allow…
            </button>
          )}
        </div>

        <p className="rsx-note">
          {pushAvailable
            ? "Exams and tasks remind you the evening before they're due, and tasks remind you again shortly before they start."
            : "Exams and tasks remind you the day before they're due, and tasks remind you again shortly before they start. Install the app to get them while it's closed."}
        </p>
      </div>
    </Modal>
  );
};

export default ReminderSettingsModal;
