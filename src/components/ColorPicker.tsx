import React, { useEffect, useMemo, useRef, useState } from "react";
import "../css/ColorPicker.css";

const SITE_COLORS = [
  "#1db954", // app green
  "#16a34a",
  "#3498db",
  "#2563eb",
  "#9b59b6",
  "#7c3aed",
  "#e67e22",
  "#e74c3c",
  "#f1c40f",
  "#1abc9c",
  "#52525b",
  "#1a1a1a",
];

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHex = (s: string): string | null => {
  const m = s.trim().match(HEX_RE);
  if (!m) return null;
  const body = m[1];
  if (body.length === 3) {
    return `#${body
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  return `#${body}`.toLowerCase();
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const c = (x: number) =>
    Math.round(Math.max(0, Math.min(255, x)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
};

const rgbToHsv = (r: number, g: number, b: number) => {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rN) h = ((gN - bN) / d) % 6;
    else if (max === gN) h = (bN - rN) / d + 2;
    else h = (rN - gN) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [rN, gN, bN] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];
  return {
    r: (rN + m) * 255,
    g: (gN + m) * 255,
    b: (bN + m) * 255,
  };
};

const hexToHsv = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
};

const hsvToHex = (h: number, s: number, v: number) => {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
};

const ColorPicker: React.FC<Props> = ({ value, onChange, disabled }) => {
  const initial = useMemo(
    () => hexToHsv(value && normalizeHex(value) ? normalizeHex(value)! : "#1db954"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [v, setV] = useState(initial.v);
  const [hexDraft, setHexDraft] = useState(value ?? "");
  const [hexInvalid, setHexInvalid] = useState(false);
  const [copied, setCopied] = useState(false);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync internal HSV when external value changes (and isn't already in sync).
  useEffect(() => {
    if (!value) {
      setHexDraft("");
      return;
    }
    const norm = normalizeHex(value);
    if (!norm) return;
    const cur = hsvToHex(h, s, v);
    if (cur !== norm) {
      const next = hexToHsv(norm);
      setH(next.h);
      setS(next.s);
      setV(next.v);
    }
    setHexDraft(norm);
    setHexInvalid(false);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nh: number, ns: number, nv: number) => {
    const hex = hsvToHex(nh, ns, nv);
    setHexDraft(hex);
    setHexInvalid(false);
    onChange(hex);
  };

  const handleSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    setS(ns);
    setV(nv);
    emit(h, ns, nv);
  };

  const handleHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nh = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 360;
    setH(nh);
    emit(nh, s, v);
  };

  const startDrag = (
    e: React.PointerEvent,
    handler: (x: number, y: number) => void
  ) => {
    if (disabled) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handler(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => handler(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const commitHex = () => {
    const trimmed = hexDraft.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const norm = normalizeHex(trimmed);
    if (norm) {
      onChange(norm);
      setHexInvalid(false);
    } else {
      setHexInvalid(true);
    }
  };

  const copyHex = async () => {
    const text = (value ?? hsvToHex(h, s, v)).toUpperCase();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const hueColor = `hsl(${h}, 100%, 50%)`;
  const currentHex = value || hsvToHex(h, s, v);

  return (
    <div className="cp">
      <div
        ref={svRef}
        className="cp-sv"
        style={{ background: hueColor }}
        onPointerDown={(e) => startDrag(e, handleSv)}
      >
        <div className="cp-sv-saturation" />
        <div className="cp-sv-value" />
        <div
          className="cp-sv-cursor"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        className="cp-hue"
        onPointerDown={(e) => startDrag(e, (x) => handleHue(x))}
      >
        <div className="cp-hue-cursor" style={{ left: `${(h / 360) * 100}%` }} />
      </div>

      <div className="cp-hex-row">
        <span className="cp-hex-label">Hex</span>
        <div className="cp-hex-wrap">
          <span
            className="cp-current-swatch"
            style={{ background: currentHex }}
            aria-label="Current color"
          />
          <input
            type="text"
            className={`cp-hex ${hexInvalid ? "invalid" : ""}`}
            value={hexDraft}
            placeholder="#1DB954"
            spellCheck={false}
            onChange={(e) => {
              setHexDraft(e.target.value);
              setHexInvalid(false);
            }}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitHex();
              } else if (e.key === "Escape") {
                setHexDraft(value ?? "");
                setHexInvalid(false);
              }
            }}
            disabled={disabled}
          />
          <button
            type="button"
            className="cp-copy"
            onClick={copyHex}
            disabled={disabled || !currentHex}
            title={copied ? "Copied" : "Copy hex"}
            aria-label="Copy hex"
          >
            {copied ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M3 8.5l3 3 7-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect
                  x="5"
                  y="5"
                  width="9"
                  height="9"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M3.5 11V3.5A.5.5 0 0 1 4 3h7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="cp-presets-label">Site colors</div>
      <div className="cp-presets">
        {SITE_COLORS.map((c) => {
          const selected = value?.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              className={`cp-preset ${selected ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              disabled={disabled}
              aria-label={`Color ${c}`}
            />
          );
        })}
        <button
          type="button"
          className="cp-reset"
          onClick={() => onChange(null)}
          disabled={disabled || !value}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ColorPicker;
