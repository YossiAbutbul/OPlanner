import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../css/CustomSelect.css";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

const CustomSelect: React.FC<Props> = ({ value, options, onChange, placeholder = "Select", id }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popH = popRef.current?.offsetHeight ?? 240;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const openUp = below < popH + 12 && above > below;
      const top = openUp ? rect.top - popH - 6 : rect.bottom + 6;
      setPos({ top, left: rect.left, width: rect.width });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="cs-wrap" ref={wrapRef}>
      <button
        id={id}
        type="button"
        className="cs-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`cs-value ${selected ? "" : "cs-value-empty"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`cs-chevron ${open ? "cs-chevron-open" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 5 7 9 11 5" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          className="cs-popover"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`cs-option ${o.value === value ? "cs-option-active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
