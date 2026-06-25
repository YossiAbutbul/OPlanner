import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Position the portalled popup under the trigger (fixed coords).
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => setOpen(false);
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
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
      {open &&
        pos &&
        createPortal(
          <div ref={popRef} className="ne-hl-pop" style={{ top: pos.top, left: pos.left }}>
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
          </div>,
          document.body
        )}
    </div>
  );
};

export default HighlightPicker;
