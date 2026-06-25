import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { FONT_SIZES } from "../../utility/notesEditorDom";

interface Props {
  value: number;
  onChange: (px: number) => void;
}

const FontSizePicker: React.FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLUListElement>(null);

  // Position the portalled popup under the trigger (fixed coords).
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.right, width: r.width });
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
      {open &&
        pos &&
        createPortal(
          <ul
            ref={popRef}
            className="ne-fs-pop"
            role="listbox"
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              transform: "translateX(-100%)",
            }}
          >
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
          </ul>,
          document.body
        )}
    </div>
  );
};

export default FontSizePicker;
