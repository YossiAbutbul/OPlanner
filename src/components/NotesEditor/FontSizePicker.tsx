import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FONT_SIZES } from "../../utility/notesEditorDom";

interface Props {
  value: number;
  onChange: (px: number) => void;
}

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
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ne-fs-value">{value}</span>
        <ChevronDown className="ne-fs-caret" size={12} strokeWidth={2.5} />
      </button>
      {open && (
        <ul className="ne-fs-pop" role="listbox">
          {FONT_SIZES.map((sz) => (
            <li
              key={sz}
              className={`ne-fs-item ${sz === value ? "ne-fs-item-active" : ""}`}
              role="option"
              aria-selected={sz === value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(sz);
                setOpen(false);
              }}
            >
              {sz}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FontSizePicker;
