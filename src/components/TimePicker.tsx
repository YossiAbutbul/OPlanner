import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../css/TimePicker.css";

interface Props {
  value: string; // "HH:mm" 24h, or "" for empty
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  minTime?: string; // HH:mm — values <= this are hidden / rejected
}

const POPOVER_WIDTH = 150;

const pad = (n: number) => String(n).padStart(2, "0");

// Build 30-min slot list
const buildSlots = (): string[] => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  return out;
};

const SLOTS = buildSlots();

const isValid = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const TimePicker: React.FC<Props> = ({ value, onChange, label, id, disabled, placeholder = "--:--", minTime }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popH = popRef.current?.offsetHeight ?? 280;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const openUp = below < popH + 12 && above > below;
      const top = openUp ? rect.top - popH - 6 : rect.bottom + 6;
      // Right-align popover to trigger's right edge.
      const desiredLeft = rect.right - POPOVER_WIDTH;
      const left = Math.min(
        Math.max(8, desiredLeft),
        window.innerWidth - POPOVER_WIDTH - 8
      );
      setPos({ top, left });
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
      const inWrap = wrapRef.current?.contains(t);
      const inPop = popRef.current?.contains(t);
      if (!inWrap && !inPop) setOpen(false);
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

  // Scroll selected slot — or current-hour if no selection — to top of list.
  // Use explicit scrollTop (NOT scrollIntoView, which scrolls the document
  // because the popover renders in a portal).
  useEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const sel = list.querySelector<HTMLButtonElement>(".tp-slot-active");
    if (sel) {
      list.scrollTop = sel.offsetTop - list.offsetTop;
      return;
    }
    // No value picked yet — scroll to current hour floor.
    const now = new Date();
    const target = `${String(now.getHours()).padStart(2, "0")}:00`;
    const node = Array.from(list.querySelectorAll<HTMLButtonElement>(".tp-slot"))
      .find((b) => b.textContent === target);
    if (node) {
      list.scrollTop = node.offsetTop - list.offsetTop;
    }
  }, [open]);

  const display = useMemo(() => {
    if (!value) return placeholder;
    return value;
  }, [value, placeholder]);

  const passesMin = (v: string) => !minTime || v > minTime;

  const commit = (v: string) => {
    if (isValid(v) && passesMin(v)) {
      onChange(v);
      setOpen(false);
    }
  };

  const visibleSlots = useMemo(
    () => SLOTS.filter((s) => passesMin(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minTime]
  );

  const onDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
    }
  };

  return (
    <div className="tp-wrap" ref={wrapRef}>
      {label && <label htmlFor={id} className="tp-external-label">{label}</label>}
      <button
        id={id}
        type="button"
        className={`tp-trigger ${disabled ? "tp-trigger-disabled" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
        <span className={`tp-trigger-value ${!value ? "tp-trigger-empty" : ""}`}>
          {display}
        </span>
        <svg
          className={`tp-trigger-chevron ${open ? "tp-trigger-chevron-open" : ""}`}
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
          className="tp-popover"
          role="dialog"
          aria-label="Pick time"
          style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
        >
          <div className="tp-input-row">
            <input
              type="text"
              inputMode="numeric"
              className={`tp-input ${draft && !isValid(draft) ? "tp-input-invalid" : ""}`}
              value={draft}
              onChange={(e) => {
                const raw = e.target.value;
                const prev = draft;
                // Auto-insert ":" after 2 digits when typing forward.
                // Skip if user is deleting or already has a ":".
                if (
                  raw.length === 2 &&
                  prev.length < raw.length &&
                  /^\d{2}$/.test(raw)
                ) {
                  setDraft(raw + ":");
                  return;
                }
                setDraft(raw);
              }}
              onKeyDown={onDraftKey}
              placeholder="HH:mm"
              maxLength={5}
              autoFocus
            />
            <button
              type="button"
              className="tp-input-ok"
              onClick={() => commit(draft)}
              disabled={!isValid(draft) || !passesMin(draft)}
              aria-label="Apply time"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 12 10 18 20 6" />
              </svg>
            </button>
          </div>
          <div className="tp-list" ref={listRef}>
            {visibleSlots.map((s) => (
              <button
                key={s}
                type="button"
                className={`tp-slot ${s === value ? "tp-slot-active" : ""}`}
                onClick={() => commit(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TimePicker;
