import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Underline, Highlighter, Type, Maximize2, X } from "lucide-react";
import "../css/NotesEditor.css";

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
}

const HIGHLIGHT_COLORS: { label: string; value: string; swatch: string }[] = [
  { label: "None", value: "transparent", swatch: "transparent" },
  { label: "Yellow", value: "#fff59d", swatch: "#fff59d" },
  { label: "Green", value: "#a5d6a7", swatch: "#a5d6a7" },
  { label: "Blue", value: "#90caf9", swatch: "#90caf9" },
  { label: "Pink", value: "#f48fb1", swatch: "#f48fb1" },
  { label: "Orange", value: "#ffcc80", swatch: "#ffcc80" },
];

const HighlightPicker: React.FC<{ onPick: (color: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);
  return (
    <div className="ne-hl-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ne-btn"
        title="Highlight"
        aria-label="Highlight"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <Highlighter size={14} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="ne-hl-pop">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`ne-hl-swatch ${c.value === "transparent" ? "ne-hl-swatch-none" : ""}`}
              style={{ background: c.swatch }}
              title={c.label}
              aria-label={c.label}
              onMouseDown={(e) => {
                e.preventDefault(); // keep editor selection
                onPick(c.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NotesEditor: React.FC<Props> = ({ value, onChange, placeholder = "Optional" }) => {
  const [expanded, setExpanded] = useState(false);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Sync external value into collapsed editor only when it diverges.
  useEffect(() => {
    const el = collapsedRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  // When entering expanded, seed it with current value. Don't re-sync on every
  // value change — expanded is a staging area until Save.
  useEffect(() => {
    if (!expanded) return;
    const el = expandedRef.current;
    if (el) {
      el.innerHTML = value || "";
      el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const editorEl = () => (expanded ? expandedRef : collapsedRef).current;

  const emitCollapsed = () => {
    const el = collapsedRef.current;
    if (el) onChange(el.innerHTML);
  };

  const exec = (cmd: "bold" | "underline") => {
    editorEl()?.focus();
    document.execCommand(cmd, false);
    if (!expanded) emitCollapsed();
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
    if (el) onChange(el.innerHTML);
    setExpanded(false);
  };

  const handleDiscardExpanded = () => {
    setExpanded(false);
  };

  const toolbar = () => (
    <div className="ne-toolbar">
      <button type="button" className="ne-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} title="Bold" aria-label="Bold">
        <Bold size={14} strokeWidth={2.5} />
      </button>
      <button type="button" className="ne-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} title="Underline" aria-label="Underline">
        <Underline size={14} strokeWidth={2} />
      </button>
      <label className="ne-btn ne-color-btn" title="Text color" aria-label="Text color" onMouseDown={(e) => e.preventDefault()}>
        <Type size={14} strokeWidth={2.5} />
        <input
          type="color"
          defaultValue="#1a1a1a"
          onChange={(e) => applyColor("foreColor", e.target.value)}
        />
      </label>
      <HighlightPicker onPick={(c) => applyColor("hiliteColor", c)} />
    </div>
  );

  return (
    <div className="ne-wrap">
      <div
        ref={collapsedRef}
        className="ne-collapsed"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitCollapsed}
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
              {toolbar()}
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
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotesEditor;
