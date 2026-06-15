import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Link2, Pencil, Trash2, X } from "lucide-react";
import NotesEditor from "./NotesEditor";
import DeleteModal from "./DeleteModal";
import { useCourseMeta } from "../hooks/useCourseMeta";
import { useToast } from "../context/ToastContext";
import { MAX_LINKS, isValidLinkUrl } from "../services/courseMeta";
import type { CourseLink, CourseTab } from "../types/models";
import "../css/CourseInfoPanel.css";

// NotesEditor is imported statically (not lazy): the Course info tab needs it
// immediately, and a lazy chunk produced a "Loading editor…" flash on tab
// switch. It already ships in the bundle for task notes anyway.

interface Props {
  activeTab: CourseTab;
  // Rendered below Links + Notes inside the Course info tab. Slotted from
  // MainContent so the homework table keeps its existing data wiring.
  assignments?: React.ReactNode;
}

const NOTES_DEBOUNCE_MS = 800;

// A row being edited (existing link or a brand-new one). `isNew` rows are
// discarded on cancel; existing rows revert to their saved values.
interface Draft {
  id: string;
  label: string;
  url: string;
  isNew: boolean;
}

// Course Info tab: a saved-links table (append rows, edit/delete inline) plus
// rich-text notes. Links commit on Save; notes auto-save debounced.
const CourseInfoPanel: React.FC<Props> = ({ activeTab, assignments }) => {
  const { meta, save } = useCourseMeta(activeTab);
  const toast = useToast();

  // Committed links mirror the hook. Local copy so reorder/delete feel
  // instant; re-synced when the remote set actually changes.
  const [links, setLinks] = useState<CourseLink[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  // Link pending delete confirmation (null = no modal).
  const [pendingDelete, setPendingDelete] = useState<CourseLink | null>(null);

  const lastRemoteRef = useRef<string>("");
  useEffect(() => {
    const remote = meta.links ?? [];
    const key = JSON.stringify(remote.map((l) => [l.id, l.label, l.url]));
    if (key !== lastRemoteRef.current) {
      lastRemoteRef.current = key;
      setLinks(remote);
    }
  }, [meta.links]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  // Persist the whole links array optimistically.
  const commitLinks = (next: CourseLink[]) => {
    lastRemoteRef.current = JSON.stringify(next.map((l) => [l.id, l.label, l.url]));
    setLinks(next);
    saveRef.current({ links: next }).catch((e) => {
      console.error("Error saving course links:", e);
      toast.error("Couldn't save links. Try again.");
    });
  };

  const startAdd = () => {
    setDraftError(null);
    setDraft({ id: crypto.randomUUID(), label: "", url: "", isNew: true });
  };

  const startEdit = (link: CourseLink) => {
    setDraftError(null);
    setDraft({ ...link, isNew: false });
  };

  const cancelDraft = () => {
    setDraft(null);
    setDraftError(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const label = draft.label.trim();
    const url = draft.url.trim();
    if (!label) { setDraftError("Name required"); return; }
    if (!isValidLinkUrl(url)) { setDraftError("Must be a valid http(s) link"); return; }

    const clean: CourseLink = { id: draft.id, label, url };
    const next = draft.isNew
      ? [...links, clean]
      : links.map((l) => (l.id === draft.id ? clean : l));
    commitLinks(next);
    setDraft(null);
    setDraftError(null);
  };

  const removeLink = (id: string) => {
    if (draft?.id === id) cancelDraft();
    commitLinks(links.filter((l) => l.id !== id));
  };

  // Notes: debounced + flushed on unmount/course switch.
  const pendingNotesRef = useRef<string | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNotes = useCallback(() => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = null;
    if (pendingNotesRef.current === null) return;
    const html = pendingNotesRef.current;
    pendingNotesRef.current = null;
    saveRef.current({ courseNotes: html }).catch((e) => {
      console.error("Error saving course notes:", e);
      toast.error("Couldn't save notes. Try again.");
    });
  }, [toast]);

  const handleNotesChange = (html: string) => {
    pendingNotesRef.current = html;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(flushNotes, NOTES_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => flushNotes();
  }, [activeTab.year, activeTab.semester, activeTab.course, flushNotes]);

  const editing = draft !== null;
  const atLinkLimit = links.length >= MAX_LINKS;

  // The inline edit form, shared by "edit existing" and "add new".
  const renderEditRow = () => draft && (
    <div className="cip-table-row cip-row-editing" role="row">
      <input
        role="cell"
        type="text"
        className="cip-input"
        placeholder="Name (e.g. Moodle)"
        maxLength={100}
        autoFocus
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") saveDraft(); if (e.key === "Escape") cancelDraft(); }}
      />
      <input
        role="cell"
        type="url"
        className="cip-input"
        placeholder="https://…"
        maxLength={2000}
        value={draft.url}
        onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") saveDraft(); if (e.key === "Escape") cancelDraft(); }}
      />
      <span role="cell" className="cip-col-actions">
        <button
          type="button"
          className="cip-row-btn cip-row-save"
          onClick={saveDraft}
          aria-label="Save link"
          title="Save"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          className="cip-row-btn"
          onClick={cancelDraft}
          aria-label="Cancel"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </span>
      {draftError && <div className="cip-row-error">{draftError}</div>}
    </div>
  );

  return (
    <div className="cip">
      <section className="cip-section">
        <div className="cip-section-head">
          <h3>Links</h3>
          <button
            type="button"
            className="cip-head-add"
            onClick={startAdd}
            disabled={atLinkLimit || editing}
            title={atLinkLimit ? `Limit of ${MAX_LINKS} links` : "Add link"}
          >
            <Link2 size={14} />
            Add
          </button>
        </div>
        <div className="cip-table" role="table">
          <div className="cip-table-head" role="row">
            <span role="columnheader" className="cip-col-name">Name</span>
            <span role="columnheader" className="cip-col-url">URL</span>
            <span role="columnheader" className="cip-col-actions">Actions</span>
          </div>

          {links.length === 0 && !draft && (
            <div className="cip-table-empty">
              No links yet. Add Moodle, Zoom, a Drive folder…
            </div>
          )}

          {links.map((l) =>
            draft && !draft.isNew && draft.id === l.id ? (
              <React.Fragment key={l.id}>{renderEditRow()}</React.Fragment>
            ) : (
              <div key={l.id} className="cip-table-row" role="row">
                <span role="cell" className="cip-col-name cip-cell-label">{l.label}</span>
                <a
                  role="cell"
                  className="cip-col-url cip-cell-url"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l.url}
                >
                  {l.url}
                  <ExternalLink size={12} className="cip-cell-url-icon" />
                </a>
                <span role="cell" className="cip-col-actions">
                  <button
                    type="button"
                    className="cip-row-btn"
                    onClick={() => startEdit(l)}
                    disabled={editing}
                    aria-label="Edit link"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="cip-row-btn cip-row-delete"
                    onClick={() => setPendingDelete(l)}
                    disabled={editing}
                    aria-label="Delete link"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            )
          )}

          {draft?.isNew && renderEditRow()}
        </div>
      </section>

      <section className="cip-section cip-notes">
        <div className="cip-section-head">
          <h3>Notes</h3>
        </div>
        <NotesEditor
          key={`${activeTab.year}|${activeTab.semester}|${activeTab.course}`}
          value={meta.courseNotes ?? ""}
          onChange={handleNotesChange}
          placeholder="Syllabus highlights, grading breakdown, anything course-wide…"
          inlineToolbar
          links={links}
          onSave={flushNotes}
        />
      </section>

      {assignments && (
        <section className="cip-section cip-assignments">
          <div className="cip-section-head">
            <h3>Assignments</h3>
          </div>
          {assignments}
        </section>
      )}

      <DeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeLink(pendingDelete.id);
          setPendingDelete(null);
        }}
        title="Delete link"
        message={`Delete “${pendingDelete?.label ?? "this link"}”? This can't be undone.`}
      />
    </div>
  );
};

export default CourseInfoPanel;
