import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Type } from "lucide-react";

// Preset text colors. "default" resets to the editor's base color (unsetColor).
const TEXT_COLORS: { label: string; value: string; swatch: string }[] = [
  { label: "Default", value: "default", swatch: "#1a1a1a" },
  { label: "Gray", value: "#868e96", swatch: "#868e96" },
  { label: "Red", value: "#e03131", swatch: "#e03131" },
  { label: "Orange", value: "#f08c00", swatch: "#f08c00" },
  { label: "Yellow", value: "#f5b400", swatch: "#f5b400" },
  { label: "Green", value: "#2f9e44", swatch: "#2f9e44" },
  { label: "Teal", value: "#0c8599", swatch: "#0c8599" },
  { label: "Blue", value: "#1971c2", swatch: "#1971c2" },
  { label: "Purple", value: "#9c36b5", swatch: "#9c36b5" },
  { label: "Pink", value: "#e64980", swatch: "#e64980" },
];

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
const normalizeHex = (s: string) => (s.startsWith("#") ? s : `#${s}`).toLowerCase();

interface Props {
  /** Current color at the caret (hex), or undefined when default. */
  value?: string;
  /** Apply a color. Receives "default" to reset, otherwise a hex string. */
  onPick: (color: string) => void;
}

const TextColorPicker: React.FC<Props> = ({ value, onPick }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [hex, setHex] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Seed the hex field from the active color whenever the popup opens.
  useEffect(() => {
    if (open) setHex(value ?? "");
  }, [open, value]);

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

  const apply = (color: string) => {
    onPick(color);
    setOpen(false);
  };

  // Live-apply a valid hex while typing, without closing the popup.
  const onHexChange = (raw: string) => {
    setHex(raw);
    if (HEX_RE.test(raw.trim())) onPick(normalizeHex(raw.trim()));
  };

  const swatchValue = value && HEX_RE.test(value) ? value : "#1a1a1a";

  return (
    <div className="ne-hl-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ne-btn ne-tc-btn"
        title="Text color"
        aria-label="Text color"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <Type size={14} strokeWidth={2.5} />
        <span className="ne-tc-bar" style={{ background: value ?? "#1a1a1a" }} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={popRef} className="ne-tc-pop" style={{ top: pos.top, left: pos.left }}>
            <div className="ne-tc-label">Text color</div>
            <div className="ne-tc-grid">
              {TEXT_COLORS.map((c) => {
                const active = (c.value === "default" && !value) || c.value === value;
                return (
                  <button
                    key={c.label}
                    type="button"
                    className={`ne-tc-swatch ${active ? "ne-tc-swatch-active" : ""}`}
                    style={{ background: c.swatch }}
                    title={c.label}
                    aria-label={c.label}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep editor selection
                      apply(c.value);
                    }}
                  >
                    {active && <Check size={13} strokeWidth={3} className="ne-tc-check" />}
                  </button>
                );
              })}
            </div>

            <div className="ne-tc-label ne-tc-label-custom">Custom</div>
            <div className="ne-tc-custom">
              {/* Native picker = color wheel / eyedropper for arbitrary colors. */}
              <label className="ne-tc-wheel" title="Pick a color" onMouseDown={(e) => e.preventDefault()}>
                <span className="ne-tc-wheel-dot" style={{ background: swatchValue }} />
                <input
                  type="color"
                  value={swatchValue}
                  onChange={(e) => {
                    setHex(e.target.value);
                    onPick(e.target.value);
                  }}
                />
              </label>
              <input
                type="text"
                className="ne-tc-hex"
                placeholder="#RRGGBB"
                value={hex}
                spellCheck={false}
                maxLength={7}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => onHexChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (HEX_RE.test(hex.trim())) apply(normalizeHex(hex.trim()));
                  }
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default TextColorPicker;
