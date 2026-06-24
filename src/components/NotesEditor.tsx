import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import Mention from "@tiptap/extension-mention";
import { Maximize2, X } from "lucide-react";
import NotesToolbar from "./NotesEditor/NotesToolbar";
import { makeMentionSuggestion } from "./NotesEditor/mentionSuggestion";
import { sanitize } from "../utility/notesEditorDom";
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
  const wrapRef = useRef<HTMLDivElement>(null);
  // Tracks the last sanitized HTML we emitted, so an external `value` echoing
  // our own change back doesn't trigger a setContent (which would reset caret).
  const lastEmittedRef = useRef<string | null>(null);
  // Bumped on every editor transaction to re-render the toolbar's active state.
  const [, setTick] = useState(0);

  // Keep a live getter for the @-mention picker so it always sees current links
  // without re-creating the editor when `links` changes.
  const linksRef = useRef<MentionLink[]>(links ?? []);
  useEffect(() => {
    linksRef.current = links ?? [];
  }, [links]);
  const getLinks = useCallback(() => linksRef.current, []);

  const hasMentions = (links ?? []).length > 0;

  const extensions = useMemo(() => {
    const base: Extensions = [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: {
          openOnClick: true,
          autolink: true,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ];
    if (hasMentions) {
      base.push(
        Mention.configure({
          // getLinks reads linksRef only when the picker fires at runtime, never
          // during render — the ref-in-render rule is a false positive here.
          // eslint-disable-next-line react-hooks/refs
          suggestion: makeMentionSuggestion(getLinks) as never,
        })
      );
    }
    return base;
    // Re-create only when mentions toggle on/off or the placeholder changes;
    // getLinks is stable and keeps the picker's link list fresh without rebuild.
  }, [placeholder, hasMentions, getLinks]);

  const editor = useEditor(
    {
      extensions,
      // Registers the `dir` attribute on all nodes (default ltr = the app's
      // base direction); setTextDirection('rtl') then flips a block — including
      // its list markers, which follow the inline-start edge.
      textDirection: "ltr",
      content: sanitize(value),
      onUpdate: ({ editor }) => {
        const html = sanitize(editor.getHTML());
        lastEmittedRef.current = html;
        onChange(html);
      },
      onTransaction: () => setTick((t) => t + 1),
    },
    [extensions]
  );

  // Sync external value changes into the editor (e.g. parent reset / load) but
  // skip our own emit echoing back, which would wipe the caret mid-edit.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    if (sanitize(editor.getHTML()) === sanitize(value)) return;
    editor.commands.setContent(sanitize(value), { emitUpdate: false });
  }, [value, editor]);

  // Lock body scroll while the expanded overlay is open.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    editor?.commands.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded, editor]);

  // Persist: in the collapsed view, flush + let the host show its "saved" toast.
  // In the expanded overlay, save/close just commits-and-collapses.
  const saveNotes = () => {
    if (!editor) return;
    const html = sanitize(editor.getHTML());
    lastEmittedRef.current = html;
    onChange(html);
    if (expanded) {
      setExpanded(false);
      return;
    }
    onSave?.();
  };
  const saveNotesRef = useRef(saveNotes);
  useEffect(() => {
    saveNotesRef.current = saveNotes;
  });

  // Ctrl/Cmd+S anywhere within this editor saves instead of the browser saving
  // the page. Capture phase so we win before the default.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Match the physical S key (e.code) — with a non-Latin layout (e.g.
      // Hebrew) e.key is the mapped letter, so e.key === "s" alone misses.
      const isSaveKey = e.code === "KeyS" || e.key === "s" || e.key === "S";
      if (!((e.ctrlKey || e.metaKey) && isSaveKey)) return;
      if (e.defaultPrevented) return;
      const a = document.activeElement;
      const relevant = expanded || wrapRef.current?.contains(a);
      if (!relevant) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      saveNotesRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [expanded]);

  // Esc collapses the expanded overlay.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        saveNotesRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div ref={wrapRef} className={`ne-wrap ${inlineToolbar ? "ne-wrap-toolbar" : ""} ${expanded ? "ne-wrap-expanded" : ""}`}>
      {expanded && <div className="ne-backdrop" onMouseDown={saveNotes} />}

      <div className="ne-panel-box">
        {(inlineToolbar || expanded) && (
          <div className={expanded ? "ne-head" : "ne-inline-toolbar"}>
            {expanded && <span className="ne-title">Notes</span>}
            <NotesToolbar editor={editor} />
            {expanded && (
              <button type="button" className="ne-close" onClick={saveNotes} title="Close" aria-label="Close">
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        <EditorContent editor={editor} className={expanded ? "ne-editor" : "ne-collapsed"} />

        {expanded ? (
          <div className="ne-footer">
            <button type="button" className="ne-save-btn" onClick={saveNotes}>
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ne-expand-btn"
            onClick={() => setExpanded(true)}
            title="Expand"
            aria-label="Expand notes"
          >
            <Maximize2 size={14} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};

export default NotesEditor;
