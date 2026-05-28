import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Underline, Highlighter, Type, Maximize2, X, AlignLeft, AlignRight } from "lucide-react";
import "../css/NotesEditor.css";

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
}

const HIGHLIGHT_COLORS: { label: string; value: string; swatch: string }[] = [
  { label: "None", value: "transparent", swatch: "transparent" },
  { label: "Yellow", value: "#fff59d", swatch: "#fff59d" },
  { label: "Green", value: "#a5d6a7", swatch: "#a5d6a7" },
  { label: "Blue", value: "#90caf9", swatch: "#90caf9" },
  { label: "Pink", value: "#f48fb1", swatch: "#f48fb1" },
  { label: "Orange", value: "#ffcc80", swatch: "#ffcc80" },
];

const HighlightPicker: React.FC<{ onPick: (color: string) => void }> = ({ onPick }) => {
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

const NotesEditor: React.FC<Props> = ({ value, onChange, placeholder = "Optional" }) => {
  const [expanded, setExpanded] = useState(false);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{
    bold: boolean;
    underline: boolean;
    dir: "" | "ltr" | "rtl";
  }>({ bold: false, underline: false, dir: "" });

  // Sync external value into collapsed editor only when it diverges.
  useEffect(() => {
    const el = collapsedRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  // When entering expanded, seed it with current value. Don't re-sync on every
  // value change — expanded is a staging area until Save.
  useEffect(() => {
    if (!expanded) return;
    const el = expandedRef.current;
    if (el) {
      el.innerHTML = value || "";
      el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const editorEl = () => (expanded ? expandedRef : collapsedRef).current;

  // Auto-link the word ending at the caret if it's a URL.
  const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i;
  const autoLinkAtCaret = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    // Don't double-wrap if caret is already inside an <a>
    let p: Node | null = node.parentNode;
    while (p && (p as Element).tagName !== undefined) {
      if ((p as Element).tagName === "A") return;
      p = p.parentNode;
    }
    const textBefore = (node.textContent || "").slice(0, range.startOffset);
    const m = textBefore.match(URL_REGEX);
    if (!m) return;
    const url = m[0];
    const href = url.startsWith("http") ? url : `https://${url}`;
    // Replace url chars with <a>
    const start = range.startOffset - url.length;
    const replaceRange = document.createRange();
    replaceRange.setStart(node, start);
    replaceRange.setEnd(node, range.startOffset);
    replaceRange.deleteContents();
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;
    replaceRange.insertNode(a);
    // Move caret after <a>
    const newRange = document.createRange();
    newRange.setStartAfter(a);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  };

  // Open links on click (contenteditable normally suppresses link nav)
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const a = target.closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    // Ctrl/Cmd-click → open; plain click in expanded just opens too
    e.preventDefault();
    window.open(a.href, "_blank", "noopener,noreferrer");
  };

  // Track active formatting state for toolbar highlight
  const refreshActive = () => {
    const el = editorEl();
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode;
    if (!anchor || !el.contains(anchor)) return;
    let bold = false;
    let underline = false;
    try {
      bold = document.queryCommandState("bold");
      underline = document.queryCommandState("underline");
    } catch {}
    let blockEl: HTMLElement | null = null;
    let n: Node | null = anchor;
    while (n && n !== el) {
      if (n.nodeType === 1) {
        const tag = (n as Element).tagName;
        if (tag === "LI" || tag === "DIV" || tag === "P") {
          blockEl = n as HTMLElement;
          break;
        }
      }
      n = n.parentNode;
    }
    // Only treat dir as active if explicitly set via `dir` attribute on
    // nearest block ancestor. Avoids false-positive from inherited dir.
    let d: "" | "ltr" | "rtl" = "";
    const target = blockEl ?? el;
    const ownDir = target.getAttribute("dir");
    if (ownDir === "rtl" || ownDir === "ltr") d = ownDir;
    setActive({ bold, underline, dir: d });
  };

  useEffect(() => {
    const onSel = () => {
      refreshActive();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [expanded]);

  // Detect "1." or "*"/"-" + space at start of line → convert to list
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Auto-link URL on space/Enter (before other handling)
    if (e.key === " " || e.key === "Enter") {
      autoLinkAtCaret();
    }
    if (e.key !== " ") return;
    const root = e.currentTarget;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;

    // Reject if already inside a list
    {
      let n: Node | null = range.startContainer;
      while (n && n !== root) {
        if (n.nodeType === 1 && (n as Element).tagName === "LI") return;
        n = n.parentNode;
      }
    }

    // Find inner block ancestor (DIV/P) if any; else use root
    let block: Node = root;
    {
      let n: Node | null = range.startContainer;
      while (n && n !== root) {
        if (n.nodeType === 1) {
          const tag = (n as Element).tagName;
          if (tag === "DIV" || tag === "P") {
            block = n;
            break;
          }
        }
        n = n.parentNode;
      }
    }

    // Build range from line start (block start OR last <br>) up to caret
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(range.startContainer, range.startOffset);

    // Find last <br> within pre — start range AFTER it for "line start"
    const brs = (block as Element).getElementsByTagName?.("br");
    if (brs && brs.length) {
      for (let i = brs.length - 1; i >= 0; i--) {
        const br = brs[i];
        if (pre.intersectsNode(br)) {
          pre.setStartAfter(br);
          break;
        }
      }
    }

    const leading = pre.toString();

    let listTag: "ol" | "ul" | null = null;
    if (/^1\.$/.test(leading)) listTag = "ol";
    else if (/^[*-]$/.test(leading)) listTag = "ul";
    if (!listTag) return;

    e.preventDefault();
    // Remove trigger chars from start of line
    pre.deleteContents();

    // Extract rest of the line (from caret up to next <br> or end of block)
    // so existing line content becomes the first li.
    const caretRange = sel.getRangeAt(0);
    const lineEndRange = document.createRange();
    lineEndRange.setStart(caretRange.startContainer, caretRange.startOffset);
    lineEndRange.setEnd(block, block.childNodes.length);
    // Find first <br> inside lineEndRange — end before it (and remove it)
    let trailingBr: HTMLBRElement | null = null;
    const allBrs = (block as Element).getElementsByTagName?.("br");
    if (allBrs) {
      for (let i = 0; i < allBrs.length; i++) {
        if (lineEndRange.intersectsNode(allBrs[i])) {
          trailingBr = allBrs[i];
          lineEndRange.setEndBefore(allBrs[i]);
          break;
        }
      }
    }
    const lineRest = lineEndRange.extractContents();

    const list = document.createElement(listTag);
    // Inherit direction from current block / closest [dir] ancestor
    let dirAncestor: HTMLElement | null =
      block.nodeType === 1 ? (block as HTMLElement) : (block.parentElement as HTMLElement | null);
    let inheritedDir: string | null = null;
    while (dirAncestor) {
      const d = dirAncestor.getAttribute?.("dir");
      if (d === "rtl" || d === "ltr") {
        inheritedDir = d;
        break;
      }
      if (dirAncestor === root) break;
      dirAncestor = dirAncestor.parentElement;
    }
    if (inheritedDir) list.setAttribute("dir", inheritedDir);
    const li = document.createElement("li");
    if (inheritedDir) {
      li.setAttribute("dir", inheritedDir);
      li.style.textAlign = inheritedDir === "rtl" ? "right" : "left";
    }
    if (lineRest.textContent && lineRest.textContent.length > 0) {
      li.appendChild(lineRest);
    } else {
      li.appendChild(document.createElement("br"));
    }
    list.appendChild(li);

    // Remove the trailing <br> we used as the line break — list itself
    // is a block, no need for an extra break before/after.
    if (trailingBr && trailingBr.parentNode) trailingBr.remove();

    const blockEl = block as HTMLElement;
    const blockIsEmpty =
      blockEl !== root &&
      (!blockEl.textContent || blockEl.textContent.trim() === "");

    if (blockIsEmpty) {
      blockEl.replaceWith(list);
    } else {
      // Insert list at caret position
      caretRange.insertNode(list);
    }

    // Place caret at end of li content
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);

    if (!expanded) emitCollapsed();
  };

  const emitCollapsed = () => {
    const el = collapsedRef.current;
    if (el) onChange(el.innerHTML);
  };

  const exec = (cmd: "bold" | "underline") => {
    editorEl()?.focus();
    document.execCommand(cmd, false);
    if (!expanded) emitCollapsed();
    refreshActive();
  };

  const applyDir = (dir: "ltr" | "rtl") => {
    const root = editorEl();
    if (!root) return;
    root.focus();
    const sel = window.getSelection();
    const applyToEl = (b: HTMLElement) => {
      b.setAttribute("dir", dir);
      b.style.textAlign = dir === "rtl" ? "right" : "left";
    };
    const maybeFlipParentList = (b: HTMLElement) => {
      if (b.tagName !== "LI" || !b.parentElement) return;
      const list = b.parentElement;
      if (list.tagName !== "UL" && list.tagName !== "OL") return;
      // Only flip the parent list if ALL its LI children share the new dir
      const lis = Array.from(list.children).filter((c) => c.tagName === "LI");
      const allMatch = lis.every((li) => li.getAttribute("dir") === dir);
      if (allMatch) list.setAttribute("dir", dir);
    };

    if (!sel || sel.rangeCount === 0) {
      applyToEl(root);
      if (!expanded) emitCollapsed();
      return;
    }
    const range = sel.getRangeAt(0);

    // Strict overlap: block must overlap selection with positive measure
    // (touching boundaries don't count — fixes flipping siblings below).
    const overlaps = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      // range.start strictly before r.end AND range.end strictly after r.start
      const startVsEnd = range.compareBoundaryPoints(Range.END_TO_START, r);
      const endVsStart = range.compareBoundaryPoints(Range.START_TO_END, r);
      return startVsEnd < 0 && endVsStart > 0;
    };
    const all = root.querySelectorAll("li, div, p");
    const blocks: HTMLElement[] = [];
    all.forEach((el) => {
      if (overlaps(el)) blocks.push(el as HTMLElement);
    });

    // Fall back to block ancestor of caret if no descendant blocks intersect
    if (blocks.length === 0) {
      let n: Node | null = range.startContainer;
      while (n && n !== root) {
        if (n.nodeType === 1) {
          const tag = (n as Element).tagName;
          if (tag === "LI" || tag === "DIV" || tag === "P") {
            blocks.push(n as HTMLElement);
            break;
          }
        }
        n = n.parentNode;
      }
    }

    const wrapRangeInDiv = () => {
      try {
        const wrap = document.createElement("div");
        range.surroundContents(wrap);
        applyToEl(wrap);
        return true;
      } catch {
        return false;
      }
    };

    // For a block that contains <br>s, extract just the selected line(s)
    // (between the nearest enclosing BR boundaries) and wrap them in a div.
    const wrapSelectedLines = (b: HTMLElement) => {
      const brs = Array.from(b.querySelectorAll("br"));
      let prevBr: HTMLBRElement | null = null;
      let nextBr: HTMLBRElement | null = null;
      for (const br of brs) {
        const brR = document.createRange();
        brR.selectNode(br);
        if (brR.compareBoundaryPoints(Range.END_TO_START, range) <= 0) {
          prevBr = br;
        } else if (!nextBr && brR.compareBoundaryPoints(Range.START_TO_END, range) >= 0) {
          nextBr = br;
        }
      }
      const lineRange = document.createRange();
      if (prevBr) lineRange.setStartAfter(prevBr);
      else lineRange.setStart(b, 0);
      if (nextBr) lineRange.setEndBefore(nextBr);
      else lineRange.setEnd(b, b.childNodes.length);
      const frag = lineRange.extractContents();
      const div = document.createElement("div");
      div.appendChild(frag);
      lineRange.insertNode(div);
      applyToEl(div);
    };

    if (blocks.length === 0) {
      // Bare text in root — wrap only the selected line(s) so siblings stay
      if (root.querySelector("br")) {
        wrapSelectedLines(root);
      } else if (!wrapRangeInDiv()) {
        applyToEl(root);
      }
    } else if (blocks.length === 1) {
      const b = blocks[0];
      // If the block holds multiple visual lines (contains <br>),
      // wrap only the selected line(s) so other lines aren't affected.
      if (b.querySelector("br")) {
        wrapSelectedLines(b);
      } else {
        applyToEl(b);
        maybeFlipParentList(b);
      }
    } else {
      blocks.forEach(applyToEl);
      blocks.forEach(maybeFlipParentList);
    }
    if (!expanded) emitCollapsed();
    refreshActive();
  };

  const applyColor = (cmd: "foreColor" | "hiliteColor", color: string) => {
    const el = editorEl();
    if (!el) return;
    el.focus();
    if (cmd === "hiliteColor") {
      const ok = document.execCommand("hiliteColor", false, color);
      if (!ok) document.execCommand("backColor", false, color);
    } else {
      document.execCommand(cmd, false, color);
    }
    if (!expanded) emitCollapsed();
  };

  const handleSaveExpanded = () => {
    const el = expandedRef.current;
    if (el) onChange(el.innerHTML);
    setExpanded(false);
  };

  const handleDiscardExpanded = () => {
    setExpanded(false);
  };

  const toolbar = () => (
    <div className="ne-toolbar">
      <button type="button" className={`ne-btn ${active.bold ? "ne-btn-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} title="Bold" aria-label="Bold">
        <Bold size={14} strokeWidth={2.5} />
      </button>
      <button type="button" className={`ne-btn ${active.underline ? "ne-btn-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} title="Underline" aria-label="Underline">
        <Underline size={14} strokeWidth={2} />
      </button>
      <label className="ne-btn ne-color-btn" title="Text color" aria-label="Text color" onMouseDown={(e) => e.preventDefault()}>
        <Type size={14} strokeWidth={2.5} />
        <input
          type="color"
          defaultValue="#1a1a1a"
          onChange={(e) => applyColor("foreColor", e.target.value)}
        />
      </label>
      <HighlightPicker onPick={(c) => applyColor("hiliteColor", c)} />
      <button
        type="button"
        className={`ne-btn ${active.dir === "ltr" ? "ne-btn-active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyDir("ltr")}
        title="Left-to-right"
        aria-label="Left-to-right"
      >
        <AlignLeft size={14} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={`ne-btn ${active.dir === "rtl" ? "ne-btn-active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyDir("rtl")}
        title="Right-to-left"
        aria-label="Right-to-left"
      >
        <AlignRight size={14} strokeWidth={2.5} />
      </button>
    </div>
  );

  return (
    <div className="ne-wrap">
      <div
        ref={collapsedRef}
        className="ne-collapsed"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitCollapsed}
        onKeyDown={handleEditorKeyDown}
        onClick={handleEditorClick}
      />
      <button
        type="button"
        className="ne-expand-btn"
        onClick={() => setExpanded(true)}
        title="Expand"
        aria-label="Expand notes"
      >
        <Maximize2 size={14} strokeWidth={2} />
      </button>

      {expanded && createPortal(
        <div className="ne-overlay">
          <div className="ne-panel">
            <div className="ne-head">
              <span className="ne-title">Notes</span>
              {toolbar()}
              <div className="ne-head-actions">
                <button type="button" className="ne-save-btn" onClick={handleSaveExpanded}>
                  Save
                </button>
                <button
                  type="button"
                  className="ne-close"
                  onClick={handleDiscardExpanded}
                  title="Close (discard)"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div
              ref={expandedRef}
              className="ne-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onKeyDown={handleEditorKeyDown}
              onClick={handleEditorClick}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotesEditor;
