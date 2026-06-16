import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import NotesToolbar from "./NotesEditor/NotesToolbar";
import {
  DEFAULT_FONT_SIZE,
  applyDirToSelection,
  applyFontSize,
  autoLinkAtCaret,
  handleListTriggerSpace,
  insertMentionLink,
  readActiveFontSize,
  readActiveFormatting,
  readMentionQuery,
  sanitize,
} from "../utility/notesEditorDom";
import "../css/NotesEditor.css";

// A course link the user can @-mention into the notes.
export interface MentionLink {
  id: string;
  label: string;
  url: string;
}

interface Props {
  value: string; // sanitized HTML
  onChange: (html: string) => void;
  placeholder?: string;
  // Show the formatting toolbar above the inline (collapsed) editor too,
  // not only inside the expanded overlay.
  inlineToolbar?: boolean;
  // Course links offered by the "@" mention picker. Empty/undefined disables it.
  links?: MentionLink[];
  // Invoked when the user presses Ctrl/Cmd+S in the collapsed editor — lets the
  // host persist (task save / notes flush) instead of the browser saving the page.
  onSave?: () => void;
}

const NotesEditor: React.FC<Props> = ({ value, onChange, placeholder = "Optional", inlineToolbar = false, links, onSave }) => {
  const [expanded, setExpanded] = useState(false);
  // Open @-mention picker state: the query typed after @, caret rect for
  // positioning, and the highlighted item. Null when closed.
  const [mention, setMention] = useState<{ query: string; top: number; left: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  // Tracks the last sanitized HTML we emitted. When the parent re-renders
  // with the same string, we skip the re-sync — otherwise DOMPurify's
  // normalized output would diverge from the browser's live innerHTML and
  // we'd reset the DOM mid-edit (wiping caret + freshly-set dir attribute).
  const lastEmittedRef = useRef<string | null>(null);
  const [active, setActive] = useState<{ bold: boolean; underline: boolean; dir: "" | "ltr" | "rtl"; fontSize: number }>({
    bold: false,
    underline: false,
    dir: "ltr",
    fontSize: DEFAULT_FONT_SIZE,
  });

  // Sync external value into collapsed editor only when it diverges AND it's
  // not just our own emit echoing back.
  useEffect(() => {
    const el = collapsedRef.current;
    if (!el) return;
    if (value === lastEmittedRef.current) return;
    if (el.innerHTML !== value) el.innerHTML = sanitize(value);
  }, [value]);

  // When entering expanded, seed it with current value. Don't re-sync on
  // every value change — expanded is a staging area until Save.
  useEffect(() => {
    if (!expanded) return;
    const el = expandedRef.current;
    if (el) {
      el.innerHTML = sanitize(value);
      el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const editorEl = () => (expanded ? expandedRef : collapsedRef).current;

  const emitCollapsed = () => {
    const el = collapsedRef.current;
    if (!el) return;
    const sanitized = sanitize(el.innerHTML);
    lastEmittedRef.current = sanitized;
    onChange(sanitized);
  };

  const mentionLinks = links ?? [];
  const filteredLinks = mention
    ? mentionLinks.filter((l) => l.label.toLowerCase().includes(mention.query.toLowerCase()))
    : [];

  // Re-evaluate whether the caret is in an "@token" and (re)open the picker.
  const detectMention = () => {
    if (mentionLinks.length === 0) return;
    const el = editorEl();
    if (!el) return;
    const res = readMentionQuery(el);
    if (res) {
      setMention({ query: res.query, top: res.rect.bottom + 4, left: res.rect.left });
      setMentionIndex(0);
    } else {
      setMention(null);
    }
  };

  const selectMention = (link: MentionLink) => {
    const el = editorEl();
    if (!el || !mention) return;
    insertMentionLink(el, mention.query, link.label, link.url);
    setMention(null);
    if (!expanded) emitCollapsed();
  };

  // Collapsed editor emits on every input; both editors run mention detection.
  const handleCollapsedInput = () => {
    emitCollapsed();
    detectMention();
  };

  // Open links on click — contenteditable normally suppresses link nav.
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const a = target.closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    window.open(a.href, "_blank", "noopener,noreferrer");
  };

  const refreshActive = () => {
    const el = editorEl();
    if (!el) return;
    setActive({ ...readActiveFormatting(el), fontSize: readActiveFontSize(el) });
  };

  useEffect(() => {
    const onSel = () => refreshActive();
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [expanded]);

  // Persist the notes (overlay commit when expanded, otherwise flush the
  // collapsed editor). Shared by the in-editor keydown and the document-level
  // Ctrl/Cmd+S listener below.
  const saveNotes = () => {
    setMention(null);
    if (expanded) {
      handleSaveExpanded(); // commits overlay edits + closes the overlay
      return;
    }
    emitCollapsed();
    // onSave owns the "saved" confirmation toast (see CourseInfoPanel).
    onSave?.();
  };

  // Keep a fresh ref so the document listener (registered once) always runs
  // the latest closure without re-binding on every render.
  const saveNotesRef = useRef(saveNotes);
  saveNotesRef.current = saveNotes;

  // Ctrl/Cmd+S anywhere within this editor (incl. toolbar buttons / popovers,
  // where focus isn't in the contentEditable) saves instead of letting the
  // browser save the page. Capture phase so we win before the default.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Match the physical S key (e.code) — with a non-Latin layout (e.g.
      // Hebrew) e.key is the mapped letter ("ד"), so e.key === "s" misses.
      const isSaveKey = e.code === "KeyS" || e.key === "s" || e.key === "S";
      if (!((e.ctrlKey || e.metaKey) && isSaveKey)) return;
      // Another listener already handled this press (e.g. a second editor
      // instance, or StrictMode's double-mount) — don't save/toast twice.
      if (e.defaultPrevented) return;
      const a = document.activeElement;
      const relevant =
        !!expandedRef.current || // expanded overlay is open
        wrapRef.current?.contains(a) ||
        expandedRef.current?.contains(a);
      if (!relevant) return;
      e.preventDefault();
      // stopImmediatePropagation: also blocks sibling document listeners
      // (other NotesEditor instances, HomeworkModal's own Ctrl+S).
      e.stopImmediatePropagation();
      saveNotesRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd+S handled by the document listener above; swallow here too so
    // it never falls through to the browser when focus is in the editor.
    if ((e.ctrlKey || e.metaKey) && (e.code === "KeyS" || e.key === "s" || e.key === "S")) {
      e.preventDefault();
      return;
    }
    // While the @-mention picker is open, hijack nav/confirm/dismiss keys.
    if (mention && filteredLinks.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredLinks.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredLinks.length) % filteredLinks.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredLinks[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Escape" && mention) setMention(null);
    if (e.key === " " || e.key === "Enter") autoLinkAtCaret();
    if (e.key !== " ") return;
    const root = e.currentTarget;
    if (handleListTriggerSpace(root)) {
      e.preventDefault();
      if (!expanded) emitCollapsed();
    }
  };

  const exec = (cmd: "bold" | "underline") => {
    editorEl()?.focus();
    document.execCommand(cmd, false);
    if (!expanded) emitCollapsed();
    refreshActive();
  };

  const applyDir = (dir: "ltr" | "rtl") => {
    const root = editorEl();
    if (!root) return;
    applyDirToSelection(root, dir);
    if (!expanded) emitCollapsed();
    refreshActive();
  };

  const applyFont = (px: number) => {
    const root = editorEl();
    if (!root) return;
    applyFontSize(root, px);
    if (!expanded) emitCollapsed();
    refreshActive();
  };

  const applyColor = (cmd: "foreColor" | "hiliteColor", color: string) => {
    const el = editorEl();
    if (!el) return;
    el.focus();
    if (cmd === "hiliteColor") {
      const ok = document.execCommand("hiliteColor", false, color);
      if (!ok) document.execCommand("backColor", false, color);
    } else {
      document.execCommand(cmd, false, color);
    }
    if (!expanded) emitCollapsed();
  };

  const handleSaveExpanded = () => {
    const el = expandedRef.current;
    if (el) onChange(sanitize(el.innerHTML));
    setExpanded(false);
  };

  const handleDiscardExpanded = () => setExpanded(false);

  return (
    <div ref={wrapRef} className={`ne-wrap ${inlineToolbar ? "ne-wrap-toolbar" : ""}`}>
      {inlineToolbar && !expanded && (
        <div className="ne-inline-toolbar">
          <NotesToolbar
            active={active}
            onExec={exec}
            onColor={(c) => applyColor("foreColor", c)}
            onHighlight={(c) => applyColor("hiliteColor", c)}
            onDir={applyDir}
            onFontSize={applyFont}
          />
        </div>
      )}
      <div
        ref={collapsedRef}
        className="ne-collapsed"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleCollapsedInput}
        onKeyDown={handleEditorKeyDown}
        onClick={handleEditorClick}
        onBlur={() => setTimeout(() => setMention(null), 150)}
      />
      <button
        type="button"
        className="ne-expand-btn"
        onClick={() => setExpanded(true)}
        title="Expand"
        aria-label="Expand notes"
      >
        <Maximize2 size={14} strokeWidth={2} />
      </button>

      {expanded && createPortal(
        <div className="ne-overlay">
          <div className="ne-panel">
            <div className="ne-head">
              <span className="ne-title">Notes</span>
              <NotesToolbar
                active={active}
                onExec={exec}
                onColor={(c) => applyColor("foreColor", c)}
                onHighlight={(c) => applyColor("hiliteColor", c)}
                onDir={applyDir}
                onFontSize={applyFont}
              />
              <button
                type="button"
                className="ne-close"
                onClick={handleDiscardExpanded}
                title="Close (discard)"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div
              ref={expandedRef}
              className="ne-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={detectMention}
              onKeyDown={handleEditorKeyDown}
              onClick={handleEditorClick}
              onBlur={() => setTimeout(() => setMention(null), 150)}
            />
            <div className="ne-footer">
              <button type="button" className="ne-save-btn" onClick={handleSaveExpanded}>
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mention && filteredLinks.length > 0 && createPortal(
        <ul
          className="ne-mention-pop"
          style={{ top: mention.top, left: mention.left }}
          role="listbox"
        >
          {filteredLinks.map((l, i) => (
            <li
              key={l.id}
              className={`ne-mention-item ${i === mentionIndex ? "ne-mention-item-active" : ""}`}
              role="option"
              aria-selected={i === mentionIndex}
              // mousedown (not click) + preventDefault keeps the editor's
              // selection alive so we can insert at the caret.
              onMouseDown={(e) => {
                e.preventDefault();
                selectMention(l);
              }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              {l.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default NotesEditor;
