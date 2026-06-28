import React from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import HighlightPicker from "./HighlightPicker";
import TextColorPicker from "./TextColorPicker";
import FontSizePicker from "./FontSizePicker";
import { DEFAULT_FONT_SIZE } from "../../utility/notesEditorDom";

interface Props {
  editor: Editor | null;
}

// Word-style paragraph-direction glyphs: stacked text lines + a baseline arrow
// pointing the writing direction (right = LTR, left = RTL).
const LtrIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="3" y1="10" x2="13" y2="10" />
    <line x1="3" y1="18" x2="17" y2="18" />
    <polyline points="15 16 18 18 15 20" />
  </svg>
);

const RtlIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="11" y1="10" x2="21" y2="10" />
    <line x1="7" y1="18" x2="21" y2="18" />
    <polyline points="9 16 6 18 9 20" />
  </svg>
);

// The dir of the block at the caret — checks paragraph/heading/listItem in
// turn. Defaults to "ltr" (the app's base direction) when nothing is set.
const activeDir = (editor: Editor): "ltr" | "rtl" => {
  const d =
    editor.getAttributes("paragraph").dir ||
    editor.getAttributes("heading").dir ||
    editor.getAttributes("listItem").dir;
  return d === "rtl" ? "rtl" : "ltr";
};

// The font-size (px) at the caret, read off the textStyle mark.
const activeFontSize = (editor: Editor): number => {
  const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
  if (!raw) return DEFAULT_FONT_SIZE;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? DEFAULT_FONT_SIZE : n;
};

// A single toolbar button. mousedown is prevented so clicking never steals the
// editor selection before the command runs.
const Btn: React.FC<{
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, title, onClick, children }) => (
  <button
    type="button"
    className={`ne-btn ${active ? "ne-btn-active" : ""}`}
    title={title}
    aria-label={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
  >
    {children}
  </button>
);

const NotesToolbar: React.FC<Props> = ({ editor }) => {
  if (!editor) return <div className="ne-toolbar" />;

  const dir = activeDir(editor);

  return (
    <div className="ne-toolbar">
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} strokeWidth={2.5} />
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} strokeWidth={2.5} />
      </Btn>
      <Btn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline size={14} strokeWidth={2} />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={14} strokeWidth={2.5} />
      </Btn>

      <span className="ne-sep" />

      <FontSizePicker
        value={activeFontSize(editor)}
        onChange={(px) => editor.chain().focus().setFontSize(`${px}px`).run()}
      />

      <span className="ne-sep" />

      <Btn title="Heading" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={15} strokeWidth={2.5} />
      </Btn>
      <Btn title="Subheading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} strokeWidth={2.5} />
      </Btn>
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} strokeWidth={2.5} />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} strokeWidth={2.5} />
      </Btn>

      <span className="ne-sep" />

      <TextColorPicker
        value={editor.getAttributes("textStyle").color as string | undefined}
        onPick={(c) =>
          c === "default"
            ? editor.chain().focus().unsetColor().run()
            : editor.chain().focus().setColor(c).run()
        }
      />
      <HighlightPicker
        onPick={(c) =>
          c === "transparent"
            ? editor.chain().focus().unsetHighlight().run()
            : editor.chain().focus().setHighlight({ color: c }).run()
        }
      />

      <span className="ne-sep" />

      <Btn title="Left-to-right" active={dir === "ltr"} onClick={() => editor.chain().focus().setTextDirection("ltr").run()}>
        <LtrIcon />
      </Btn>
      <Btn title="Right-to-left" active={dir === "rtl"} onClick={() => editor.chain().focus().setTextDirection("rtl").run()}>
        <RtlIcon />
      </Btn>

      <span className="ne-sep" />

      <Btn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} strokeWidth={2.5} />
      </Btn>
      <Btn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} strokeWidth={2.5} />
      </Btn>
    </div>
  );
};

export default NotesToolbar;
