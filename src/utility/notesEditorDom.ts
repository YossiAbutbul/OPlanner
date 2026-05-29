import DOMPurify from "dompurify";

// Allow only the tags/attrs this editor itself produces. Strips <script>,
// event handlers, javascript: URLs, etc. before anything reaches the DOM.
const SANITIZE_CFG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "div", "p", "span", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target", "rel", "dir", "style"],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
};

export const sanitize = (html: string): string =>
  DOMPurify.sanitize(html || "", SANITIZE_CFG);

// Auto-link the word ending at the caret if it's a URL. Mutates the DOM in
// place; nothing returned. Safe to call on every space/Enter.
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i;
export const autoLinkAtCaret = (): void => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;
  // Don't double-wrap if caret is already inside an <a>.
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
  const newRange = document.createRange();
  newRange.setStartAfter(a);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
};

// Detect "1." / "*" / "-" + space at start of a line and convert the line
// into a list. Returns true if a list was created (caller should preventDefault
// the space + emit change), false otherwise.
export const handleListTriggerSpace = (root: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;

  // Reject if already inside a list.
  {
    let n: Node | null = range.startContainer;
    while (n && n !== root) {
      if (n.nodeType === 1 && (n as Element).tagName === "LI") return false;
      n = n.parentNode;
    }
  }

  // Find inner block ancestor (DIV/P), or fall back to root.
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

  // Build range from line start (block start OR last <br>) up to caret.
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);

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
  if (!listTag) return false;

  pre.deleteContents();

  // Extract rest of line up to next <br> or end of block so existing content
  // becomes the first li.
  const caretRange = sel.getRangeAt(0);
  const lineEndRange = document.createRange();
  lineEndRange.setStart(caretRange.startContainer, caretRange.startOffset);
  lineEndRange.setEnd(block, block.childNodes.length);
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
  // Inherit direction from nearest [dir] ancestor.
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

  if (trailingBr && trailingBr.parentNode) trailingBr.remove();

  const blockEl = block as HTMLElement;
  const blockIsEmpty =
    blockEl !== root && (!blockEl.textContent || blockEl.textContent.trim() === "");
  if (blockIsEmpty) blockEl.replaceWith(list);
  else caretRange.insertNode(list);

  const newRange = document.createRange();
  newRange.selectNodeContents(li);
  newRange.collapse(false);
  sel.removeAllRanges();
  sel.addRange(newRange);
  return true;
};

// Apply LTR/RTL to the block(s) intersecting the current selection. Wraps
// bare runs in a <div> when needed and flips parent lists only if all
// siblings agree on the new direction.
export const applyDirToSelection = (root: HTMLElement, dir: "ltr" | "rtl"): void => {
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
    const lis = Array.from(list.children).filter((c) => c.tagName === "LI");
    const allMatch = lis.every((li) => li.getAttribute("dir") === dir);
    if (allMatch) list.setAttribute("dir", dir);
  };

  if (!sel || sel.rangeCount === 0) {
    applyToEl(root);
    return;
  }
  const range = sel.getRangeAt(0);

  // Strict overlap: range start strictly before block end AND range end
  // strictly after block start. Touching boundaries don't count.
  const overlaps = (el: Element) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const startVsEnd = range.compareBoundaryPoints(Range.END_TO_START, r);
    const endVsStart = range.compareBoundaryPoints(Range.START_TO_END, r);
    return startVsEnd < 0 && endVsStart > 0;
  };
  const all = root.querySelectorAll("li, div, p");
  const blocks: HTMLElement[] = [];
  all.forEach((el) => {
    if (overlaps(el)) blocks.push(el as HTMLElement);
  });

  // Fall back to block ancestor of caret if no descendant blocks intersect.
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

  // For a block containing <br>s, extract just the selected line(s) between
  // the nearest enclosing BR boundaries and wrap them in a div.
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
    if (root.querySelector("br")) wrapSelectedLines(root);
    else if (!wrapRangeInDiv()) applyToEl(root);
  } else if (blocks.length === 1) {
    const b = blocks[0];
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
};

// Active-formatting probe for toolbar highlight. Returns the bold/underline
// state from queryCommandState plus the explicit dir attribute on the
// nearest block ancestor (empty if not set).
export const readActiveFormatting = (
  root: HTMLElement
): { bold: boolean; underline: boolean; dir: "" | "ltr" | "rtl" } => {
  const empty = { bold: false, underline: false, dir: "" as const };
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return empty;
  const anchor = sel.anchorNode;
  if (!anchor || !root.contains(anchor)) return empty;
  let bold = false;
  let underline = false;
  try {
    bold = document.queryCommandState("bold");
    underline = document.queryCommandState("underline");
  } catch { /* ignore */ }
  let blockEl: HTMLElement | null = null;
  let n: Node | null = anchor;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const tag = (n as Element).tagName;
      if (tag === "LI" || tag === "DIV" || tag === "P") {
        blockEl = n as HTMLElement;
        break;
      }
    }
    n = n.parentNode;
  }
  let d: "" | "ltr" | "rtl" = "";
  const target = blockEl ?? root;
  const ownDir = target.getAttribute("dir");
  if (ownDir === "rtl" || ownDir === "ltr") d = ownDir;
  return { bold, underline, dir: d };
};
