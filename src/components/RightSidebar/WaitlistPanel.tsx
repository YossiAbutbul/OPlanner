import React, { useState } from "react";
import { joinWaitlist } from "../../services/agent";

interface Props {
  waitlisted: boolean;
  onJoined: () => void;
}

// What the Assistant tab shows accounts that don't have access yet.
const WaitlistPanel: React.FC<Props> = ({ waitlisted, onJoined }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinWaitlist();
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join the waitlist. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-agent">
      <div className="rs-agent-log">
        <div className="rs-agent-intro rs-waitlist">
          <span className="rs-waitlist-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
              <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
            </svg>
          </span>
          <p className="rs-empty-title">Study assistant</p>
          <p className="rs-empty-text">
            Ask about your semester, plan study days and add tasks by chatting. It's in early access.
          </p>
          {waitlisted ? (
            <p className="rs-waitlist-done" role="status">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              You're on the waitlist
            </p>
          ) : (
            <button type="button" className="rs-agent-btn rs-agent-btn-primary rs-waitlist-btn" onClick={() => void join()} disabled={busy}>
              {busy ? "Joining…" : "Join the waitlist"}
            </button>
          )}
          {error && <p className="rs-waitlist-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default WaitlistPanel;
