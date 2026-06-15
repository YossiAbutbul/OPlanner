import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FONT_SIZES } from "../../utility/notesEditorDom";

interface Props {
  value: number;
  onChange: (px: number) => void;
}

// Custom font-size dropdown — replaces the unstyleable native <select> popup
// with a styled popover matching the rest of the toolbar (see HighlightPicker).
const FontSizePicker: React.FC<Props> = ({ value, onChange }) => {
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
    <div className="ne-fs-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ne-fs-trigger"
        title="Font size"
        aria-label="Font size"
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} // keep editor selection
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ne-fs-value">{value}</span>
        <ChevronDown size={13} strokeWidth={2.5} className="ne-fs-caret" />
      </button>
      {open && (
        <ul className="ne-fs-pop" role="listbox" aria-label="Font size">
          {FONT_SIZES.map((s) => (
            <li
              key={s}
              role="option"
              aria-selected={s === value}
              className={`ne-fs-item ${s === value ? "ne-fs-item-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep editor selection
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FontSizePicker;
