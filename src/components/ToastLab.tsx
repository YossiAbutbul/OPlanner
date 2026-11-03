import React, { useState } from "react";
import { useToast } from "../context/ToastContext";
import {
  CONTENT_CENTER,
  CONTENT_RIGHT,
  DEFAULT_TOAST_POSITION,
  TOAST_POSITION_EVENT,
  type ToastPlacement,
} from "./AppToaster";
import "../css/ToastLab.css";

// Dev-only playground for the toast component: fire every kind from every
// position without having to reproduce the action that raises it.
// Mounted by main.tsx on ?toastlab=1 in dev builds.

const POSITIONS: [ToastPlacement, string][] = [
  ["top-left", "top left"],
  ["top-center", "top center"],
  ["top-right", "top right"],
  ["bottom-left", "bottom left"],
  ["bottom-center", "bottom center"],
  ["bottom-right", "bottom right"],
  [CONTENT_CENTER, "bottom center (content)"],
  [CONTENT_RIGHT, "bottom right (content)"],
];

const ToastLab: React.FC = () => {
  const toast = useToast();
  const [position, setPosition] = useState<ToastPlacement>(DEFAULT_TOAST_POSITION);
  const [open, setOpen] = useState(true);

  const pick = (p: ToastPlacement) => {
    setPosition(p);
    window.dispatchEvent(new CustomEvent(TOAST_POSITION_EVENT, { detail: p }));
  };

  // Every sample carries a description, so the pill expands into a card the
  // way the action toast does.
  const samples: [string, () => void][] = [
    [
      "Success",
      () =>
        toast.success("Task added", {
          description: "“Lab report 3” is due Thu, 13 Nov.",
        }),
    ],
    [
      "Error",
      () =>
        toast.error("Couldn't save notes", {
          description: "Your last edit is still here — try again.",
        }),
    ],
    [
      "Info",
      () =>
        toast.info("Nothing new to import", {
          description: "All 24 events were already on your calendar.",
        }),
    ],
    [
      "With action",
      () =>
        toast.info("Chat cleared", {
          description: "This course's conversation was removed.",
          action: { label: "Undo", onClick: () => {} },
        }),
    ],
    [
      "Sticky",
      () =>
        toast.info("New version available", {
          description: "Reload to pick up the latest build.",
          sticky: true,
          action: { label: "Reload", onClick: () => {} },
        }),
    ],
    [
      "Title only",
      () => toast.success("Notes saved"),
    ],
    [
      "Long description",
      () =>
        toast.error("Couldn't save the grade sheet", {
          description:
            "The server rejected the change. Check your connection and try again in a moment.",
        }),
    ],
    [
      "Three in a row",
      () => {
        toast.success("Course added", { description: "Algorithms · 4 credits" });
        toast.info("2 exams imported", { description: "Midterm and final" });
        toast.error("1 event skipped", { description: "It had no date." });
      },
    ],
    [
      "Spam one message",
      () => {
        toast.success("Notes saved");
        toast.success("Notes saved");
        toast.success("Notes saved");
      },
    ],
  ];

  if (!open) {
    return (
      <button type="button" className="toastlab-fab" onClick={() => setOpen(true)}>
        Toast lab
      </button>
    );
  }

  return (
    <aside className="toastlab">
      <header className="toastlab-head">
        <strong>Toast lab</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide toast lab">
          ×
        </button>
      </header>

      <p className="toastlab-label">Position</p>
      <div className="toastlab-grid">
        {POSITIONS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={value === position ? "is-active" : undefined}
            onClick={() => pick(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="toastlab-label">Fire</p>
      <div className="toastlab-grid">
        {samples.map(([label, run]) => (
          <button type="button" key={label} onClick={run}>
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default ToastLab;
