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
  readActiveFontSize,
  readActiveFormatting,
  sanitize,
} from "../utility/notesEditorDom";
import "../css/NotesEditor.css";

interface Props {
  value: string; // sanitized HTML
  onChange: (html: string) => void;
  placeholder?: string;
  // Show the formatting toolbar above the inline (collapsed) editor too,
  // not only inside the expanded overlay.
  inlineToolbar?: boolean;
}

const NotesEditor: React.FC<Props> = ({ value, onChange, placeholder = "Optional", inlineToolbar = false }) => {
  const [expanded, setExpanded] = useState(false);
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

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className={`ne-wrap ${inlineToolbar ? "ne-wrap-toolbar" : ""}`}>
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
        onInput={emitCollapsed}
        onKeyDown={handleEditorKeyDown}
        onClick={handleEditorClick}
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
              onKeyDown={handleEditorKeyDown}
              onClick={handleEditorClick}
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
    </div>
  );
};

export default NotesEditor;
