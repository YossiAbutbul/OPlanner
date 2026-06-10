import React from "react";
import { AlignLeft, AlignRight, Bold, Type, Underline } from "lucide-react";
import HighlightPicker from "./HighlightPicker";
import { FONT_SIZES } from "../../utility/notesEditorDom";

interface Props {
  active: { bold: boolean; underline: boolean; dir: "" | "ltr" | "rtl"; fontSize: number };
  onExec: (cmd: "bold" | "underline") => void;
  onColor: (color: string) => void;
  onHighlight: (color: string) => void;
  onDir: (dir: "ltr" | "rtl") => void;
  onFontSize: (px: number) => void;
}

const NotesToolbar: React.FC<Props> = ({ active, onExec, onColor, onHighlight, onDir, onFontSize }) => (
  <div className="ne-toolbar">
    <button
      type="button"
      className={`ne-btn ${active.bold ? "ne-btn-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onExec("bold")}
      title="Bold"
      aria-label="Bold"
    >
      <Bold size={14} strokeWidth={2.5} />
    </button>
    <button
      type="button"
      className={`ne-btn ${active.underline ? "ne-btn-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onExec("underline")}
      title="Underline"
      aria-label="Underline"
    >
      <Underline size={14} strokeWidth={2} />
    </button>
    <label
      className="ne-btn ne-color-btn"
      title="Text color"
      aria-label="Text color"
      onMouseDown={(e) => e.preventDefault()}
    >
      <Type size={14} strokeWidth={2.5} />
      <input
        type="color"
        defaultValue="#1a1a1a"
        onChange={(e) => onColor(e.target.value)}
      />
    </label>
    <HighlightPicker onPick={onHighlight} />
    <button
      type="button"
      className={`ne-btn ${active.dir === "ltr" ? "ne-btn-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onDir("ltr")}
      title="Left-to-right"
      aria-label="Left-to-right"
    >
      <AlignLeft size={14} strokeWidth={2.5} />
    </button>
    <button
      type="button"
      className={`ne-btn ${active.dir === "rtl" ? "ne-btn-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onDir("rtl")}
      title="Right-to-left"
      aria-label="Right-to-left"
    >
      <AlignRight size={14} strokeWidth={2.5} />
    </button>
    <select
      className="ne-fontsize"
      value={active.fontSize}
      title="Font size"
      aria-label="Font size"
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onFontSize(Number(e.target.value))}
    >
      {FONT_SIZES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  </div>
);

export default NotesToolbar;
