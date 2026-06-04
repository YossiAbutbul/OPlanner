import React, { useEffect, useState } from "react";
import { Bell, CalendarClock, AlarmClock } from "lucide-react";
import Modal from "./Modal";
import { useNotifications } from "../context/NotificationContext";
import { lsCache } from "../hooks/useLocalStorageCache";
import "../css/ReminderSettings.css";

// Shown once per device the first time a desktop user lands after the reminder
// feature ships. The flag is local-only, so a new PC sees it fresh.
const ANNOUNCE_KEY = "oplanner.notif.announced";

const ReminderAnnounceModal: React.FC = () => {
  const { supported, isDesktop, setEnabled, requestPermission } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only desktop users with notification support get the feature, so only
    // they get the announcement. Skip if already seen on this device.
    if (!supported || !isDesktop) return;
    if (lsCache.read<string>(ANNOUNCE_KEY)) return;
    setOpen(true);
  }, [supported, isDesktop]);

  const dismiss = () => {
    lsCache.write(ANNOUNCE_KEY, "1");
    setOpen(false);
  };

  const enable = async () => {
    setEnabled(true);
    await requestPermission(); // button click = a user gesture, so the prompt shows
    dismiss();
  };

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="New: Desktop reminders"
      footer={
        <button type="button" className="app-modal-btn-primary" onClick={() => void enable()}>
          OK
        </button>
      }
    >
      <div className="rsx rsx-announce">
        <div className="rsx-announce-head">
          <div className="rsx-announce-icon">
            <Bell size={24} />
          </div>
          <div className="rsx-announce-headtext">
            <p className="rsx-announce-lead">Never miss a deadline again.</p>
            <p className="rsx-announce-sub">Desktop popups for your upcoming exams and tasks.</p>
          </div>
        </div>

        <ul className="rsx-feat">
          <li>
            <span className="rsx-feat-chip"><CalendarClock size={16} /></span>
            <span>The day before exams and tasks are due</span>
          </li>
          <li>
            <span className="rsx-feat-chip"><AlarmClock size={16} /></span>
            <span>Shortly before a task is set to start</span>
          </li>
        </ul>

        <p className="rsx-note">
          Your browser will ask you to allow notifications once. Change anytime in
          Settings → Reminders.
        </p>
      </div>
    </Modal>
  );
};

export default ReminderAnnounceModal;
