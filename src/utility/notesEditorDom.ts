import DOMPurify from "dompurify";

// Allow only the tags/attrs this editor itself produces. Strips <script>,
// event handlers, javascript:/data: URLs, etc. before anything reaches the
// DOM. We deliberately do NOT set ALLOWED_URI_REGEXP: in this DOMPurify
// version that option also drops the `dir` attribute (breaking saved
// RTL/LTR direction). DOMPurify's default URI policy already blocks the
// dangerous schemes (javascript:, data:), and the editor only ever emits
// http(s)/mailto links anyway.
const SANITIZE_CFG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "div", "p", "span", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target", "rel", "dir", "style", "class"],
};

export const sanitize = (html: string): string =>
  DOMPurify.sanitize(html || "", SANITIZE_CFG);

// Word-style font sizes (px). FONT_SIZES drives the toolbar dropdown.
export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32] as const;
export const DEFAULT_FONT_SIZE = 16;

// Apply a px font-size to the current selection by wrapping it in
// <span style="font-size:Npx">. execCommand has no px-based command (and
// emits stripped <font> tags), so we wrap ranges ourselves.
//
// - Collapsed caret (e.g. a blank line): insert an empty styled span and
//   park the caret inside it, so the NEXT typed text uses the new size.
// - Selection: wrap each fully-selected text run in its own span instead of
//   surrounding whole block elements (wrapping a <div> in a <span> left the
//   block's margins inside an inline box, showing as a stray top gap).
export const applyFontSize = (root: HTMLElement, px: number): void => {
  root.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const size = `${px}px`;

  if (range.collapsed) {
    const span = document.createElement("span");
    span.style.fontSize = size;
    // Zero-width space gives the caret somewhere to live inside the empty
    // span so typing inherits the size; it renders as nothing.
    const zwsp = document.createTextNode("​");
    span.appendChild(zwsp);
    range.insertNode(span);
    const r = document.createRange();
    r.setStart(zwsp, 1);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    return;
  }

  // Collect the text nodes intersecting the selection, then wrap each
  // selected slice. Keeps block structure (and its margins) untouched.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (range.intersectsNode(node) && (node.textContent ?? "").length > 0) {
      textNodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  if (textNodes.length === 0) return;

  const wrapped: HTMLElement[] = [];
  textNodes.forEach((tn) => {
    const start = tn === range.startContainer ? range.startOffset : 0;
    const end = tn === range.endContainer ? range.endOffset : (tn.textContent ?? "").length;
    if (end <= start) return;
    const slice = document.createRange();
    slice.setStart(tn, start);
    slice.setEnd(tn, end);
    const span = document.createElement("span");
    span.style.fontSize = size;
    try {
      slice.surroundContents(span);
      wrapped.push(span);
    } catch {
      /* skip odd node */
    }
  });

  if (wrapped.length === 0) return;
  const r = document.createRange();
  r.setStartBefore(wrapped[0]);
  r.setEndAfter(wrapped[wrapped.length - 1]);
  sel.removeAllRanges();
  sel.addRange(r);
};

// Read the font-size (px) active at the caret, walking up to `root`. Returns
// DEFAULT_FONT_SIZE when no explicit size is set.
export const readActiveFontSize = (root: HTMLElement): number => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return DEFAULT_FONT_SIZE;
  let n: Node | null = sel.anchorNode;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const fs = (n as HTMLElement).style?.fontSize;
      if (fs && fs.endsWith("px")) {
        const v = parseInt(fs, 10);
        if (!Number.isNaN(v)) return v;
      }
    }
    n = n.parentNode;
  }
  return DEFAULT_FONT_SIZE;
};

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

// @-mention detection. If the collapsed caret sits at the end of an "@token"
// run (token = the chars typed after @, no whitespace/@), return that query
// plus the caret rect for positioning the link picker. Returns null when the
// caret isn't in a mention, sits inside an existing <a>, or has a selection.
const MENTION_REGEX = /@([^\s@]*)$/;
export const readMentionQuery = (
  root: HTMLElement
): { query: string; rect: DOMRect } | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if (!root.contains(node)) return null;
  // Don't trigger inside an existing link.
  let p: Node | null = node.parentNode;
  while (p && p !== root) {
    if ((p as Element).tagName === "A") return null;
    p = p.parentNode;
  }
  const textBefore = (node.textContent || "").slice(0, range.startOffset);
  const m = textBefore.match(MENTION_REGEX);
  if (!m) return null;
  const rect = range.getBoundingClientRect();
  return { query: m[1], rect };
};

// Replace the "@query" run before the caret with a link (label → href) and
// drop a trailing space, parking the caret after it. Pairs with
// readMentionQuery; `query` is what that returned (the text after @).
export const insertMentionLink = (
  root: HTMLElement,
  query: string,
  label: string,
  href: string
): void => {
  root.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;
  const removeLen = query.length + 1; // include the leading "@"
  const start = Math.max(0, range.startOffset - removeLen);
  const del = document.createRange();
  del.setStart(node, start);
  del.setEnd(node, range.startOffset);
  del.deleteContents();
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "ne-link"; // chip styling for mentioned course links
  a.textContent = label;
  del.insertNode(a);
  const space = document.createTextNode(" ");
  a.parentNode?.insertBefore(space, a.nextSibling);
  const after = document.createRange();
  after.setStart(space, 1);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
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
    // Empty or bare-text root — there's no block to flip and applying dir
    // directly to root won't reposition the caret without a child block.
    // Wrap whatever's there (or insert a fresh <div><br></div>) so the
    // browser has a dir-ed block to anchor the caret in.
    if (!root.firstChild) {
      const wrap = document.createElement("div");
      wrap.appendChild(document.createElement("br"));
      applyToEl(wrap);
      root.appendChild(wrap);
      const r = document.createRange();
      r.setStart(wrap, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else if (root.querySelector("br")) {
      wrapSelectedLines(root);
    } else if (!wrapRangeInDiv()) {
      const wrap = document.createElement("div");
      while (root.firstChild) wrap.appendChild(root.firstChild);
      applyToEl(wrap);
      root.appendChild(wrap);
      const r = document.createRange();
      r.selectNodeContents(wrap);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  } else if (blocks.length === 1) {
    const b = blocks[0];
    // If the block has BR(s) but no real text, treat it as an empty single
    // line — flip the whole block instead of trying to wrap the empty line
    // (which would create degenerate empty nested divs and lose the caret).
    const hasOnlyBr = b.querySelector("br") && !(b.textContent ?? "").trim();
    if (b.querySelector("br") && !hasOnlyBr) {
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
// state from queryCommandState plus the dir of the nearest block ancestor.
// Direction defaults to "ltr" (the app's base direction) when nothing
// explicit is set, so the LTR button reads as selected by default.
export const readActiveFormatting = (
  root: HTMLElement
): { bold: boolean; underline: boolean; dir: "" | "ltr" | "rtl" } => {
  const empty = { bold: false, underline: false, dir: "ltr" as const };
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
  let d: "" | "ltr" | "rtl" = "ltr";
  const target = blockEl ?? root;
  const ownDir = target.getAttribute("dir");
  if (ownDir === "rtl" || ownDir === "ltr") d = ownDir;
  return { bold, underline, dir: d };
};
