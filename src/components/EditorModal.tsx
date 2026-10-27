import React, { useState } from "react";
import Modal from "./Modal";
import DeleteModal from "./DeleteModal";

// The one frame every "add or edit something" dialog uses (tasks, Schedule
// blocks), so they read and behave the same: "New X" / "Edit X" in the
// title, and the same footer in the same order. Delete only exists while
// editing, always sits first on the footer's leading edge, and always asks
// before it deletes.
interface Props {
  isOpen: boolean;
  onClose: () => void;
  // What's being edited, for the title and the delete question: "task".
  noun: string;
  isEdit: boolean;
  // Name of the item, for "Delete “…”?".
  itemName?: string;
  canSave: boolean;
  saving?: boolean;
  onSave: () => void;
  // Omit to hide Delete. Resolves once it's deleted; the dialog then closes.
  onDelete?: () => void | Promise<void>;
  children: React.ReactNode;
}

const EditorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  noun,
  isEdit,
  itemName,
  canSave,
  saving = false,
  onSave,
  onDelete,
  children,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${isEdit ? "Edit" : "New"} ${noun}`}
        footer={
          <>
            {isEdit && onDelete && (
              <button
                type="button"
                className="app-modal-btn-danger-text"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="app-modal-btn-primary" onClick={onSave} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {children}
      </Modal>
      {isEdit && onDelete && (
        <DeleteModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await onDelete();
            setConfirmDelete(false);
            onClose();
          }}
          title={`Delete ${noun}`}
          message={`Delete “${itemName?.trim() || `this ${noun}`}”? This can't be undone.`}
        />
      )}
    </>
  );
};

export default EditorModal;
