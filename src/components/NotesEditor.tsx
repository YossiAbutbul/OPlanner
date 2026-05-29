import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import NotesToolbar from "./NotesEditor/NotesToolbar";
import {
  applyDirToSelection,
  autoLinkAtCaret,
  handleListTriggerSpace,
  readActiveFormatting,
  sanitize,
} from "../utility/notesEditorDom";
import "../css/NotesEditor.css";

interface Props {
  value: string; // sanitized HTML
  onChange: (html: string) => void;
  placeholder?: string;
}

const NotesEditor: React.FC<Props> = ({ value, onChange, placeholder = "Optional" }) => {
  const [expanded, setExpanded] = useState(false);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ bold: boolean; underline: boolean; dir: "" | "ltr" | "rtl" }>({
    bold: false,
    underline: false,
    dir: "",
  });

  // Sync external value into collapsed editor only when it diverges.
  useEffect(() => {
    const el = collapsedRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = sanitize(value);
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
    if (el) onChange(sanitize(el.innerHTML));
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
    setActive(readActiveFormatting(el));
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
    <div className="ne-wrap">
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
              />
              <div className="ne-head-actions">
                <button type="button" className="ne-save-btn" onClick={handleSaveExpanded}>
                  Save
                </button>
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
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotesEditor;
