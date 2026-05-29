import React, { useEffect, useRef, useState } from "react";
import { Highlighter } from "lucide-react";

const HIGHLIGHT_COLORS: { label: string; value: string; swatch: string }[] = [
  { label: "None", value: "transparent", swatch: "transparent" },
  { label: "Yellow", value: "#fff59d", swatch: "#fff59d" },
  { label: "Green", value: "#a5d6a7", swatch: "#a5d6a7" },
  { label: "Blue", value: "#90caf9", swatch: "#90caf9" },
  { label: "Pink", value: "#f48fb1", swatch: "#f48fb1" },
  { label: "Orange", value: "#ffcc80", swatch: "#ffcc80" },
];

interface Props {
  onPick: (color: string) => void;
}

const HighlightPicker: React.FC<Props> = ({ onPick }) => {
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

export default HighlightPicker;
