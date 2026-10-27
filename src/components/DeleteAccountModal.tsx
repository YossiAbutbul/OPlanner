import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { deleteAccount, resumePendingDeletion, usesPassword } from "../services/account";

interface Props {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  // Back from the Google sign-in a deletion asked for: finish it.
  resume?: boolean;
}

// Permanent, so it asks for the email typed out and a fresh sign-in.
const DeleteAccountModal: React.FC<Props> = ({ isOpen, email, onClose, resume = false }) => {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsPassword = usesPassword();

  useEffect(() => {
    if (isOpen) return;
    setTyped("");
    setPassword("");
    setError(null);
  }, [isOpen]);

  // Signed out and the local cache is gone; start from a clean page.
  const leave = () => window.location.replace(import.meta.env.BASE_URL);

  useEffect(() => {
    if (!isOpen || !resume) return;
    setBusy(true);
    resumePendingDeletion()
      .then(leave)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
        setBusy(false);
      });
  }, [isOpen, resume]);

  const confirmed = typed.trim().toLowerCase() === email.toLowerCase() && (!needsPassword || password.length > 0);

  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      // A Google account may be sent to sign in again first; the page then
      // leaves, and the deletion finishes when it comes back.
      if ((await deleteAccount(needsPassword ? password : undefined)) === "deleted") leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Delete account"
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-danger"
            onClick={() => void submit()}
            disabled={!confirmed || busy}
          >
            {busy ? (
              <span className="delete-modal-loading">
                <span className="delete-modal-spinner" />
                Deleting…
              </span>
            ) : (
              "Delete account"
            )}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>
          This permanently deletes your account and everything in it: years, courses, tasks, notes, schedule and
          reminders. It can't be undone.
        </p>
        <label htmlFor="delete-account-email">
          Type <strong>{email}</strong> to confirm
        </label>
        <input
          id="delete-account-email"
          // text, not email: the modal's field styles cover text and password.
          type="text"
          inputMode="email"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
        />
        {needsPassword ? (
          <>
            <label htmlFor="delete-account-password">Password</label>
            <input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </>
        ) : (
          <p className="delete-account-hint">If you signed in a while ago, Google will ask you to sign in again first.</p>
        )}
        {error && (
          <p className="delete-account-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default DeleteAccountModal;
