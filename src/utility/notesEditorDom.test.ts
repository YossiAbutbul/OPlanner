import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_SIZE,
  applyDirToSelection,
  applyFontSize,
  autoLinkAtCaret,
  handleListTriggerSpace,
  readActiveFontSize,
  readActiveFormatting,
  sanitize,
} from "./notesEditorDom";

const setupEditor = (initialHtml = "") => {
  const root = document.createElement("div");
  root.contentEditable = "true";
  root.innerHTML = initialHtml;
  document.body.appendChild(root);
  return root;
};

const placeCaretInTextNode = (textNode: Node, offset: number) => {
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("sanitize", () => {
  it("strips <script> and event handlers", () => {
    const dirty = '<p onclick="alert(1)">hi</p><script>alert(2)</script>';
    const clean = sanitize(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("hi");
  });

  it("strips javascript: URLs from <a href>", () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    const clean = sanitize(dirty);
    expect(clean).not.toContain("javascript:");
  });

  it("keeps allowed tags and http(s)/mailto URLs", () => {
    const dirty =
      '<p>hi</p><ul><li><a href="https://example.com">e</a></li></ul>' +
      '<a href="mailto:a@b">m</a>';
    const clean = sanitize(dirty);
    expect(clean).toContain("<p>hi</p>");
    expect(clean).toContain("<ul>");
    expect(clean).toContain("<li>");
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('href="mailto:a@b"');
  });

  it("strips disallowed tags like img/iframe", () => {
    const clean = sanitize('<img src="x"><iframe src="y"></iframe>OK');
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("OK");
  });

  it("handles empty / null input", () => {
    expect(sanitize("")).toBe("");
    // @ts-expect-error testing null tolerance
    expect(sanitize(null)).toBe("");
  });

  it("keeps the dir attribute so RTL/LTR persists", () => {
    const clean = sanitize('<div dir="rtl" style="text-align:right">שלום</div>');
    expect(clean).toContain('dir="rtl"');
    expect(clean).toContain("text-align:right");
  });

  it("keeps inline font-size", () => {
    const clean = sanitize('<span style="font-size:24px">big</span>');
    expect(clean).toContain("font-size:24px");
  });

  it("still strips data: URLs", () => {
    const clean = sanitize('<a href="data:text/html,<b>">x</a>');
    expect(clean).not.toContain("data:");
  });
});

describe("autoLinkAtCaret", () => {
  it("wraps a trailing http URL in an <a>", () => {
    const root = setupEditor("visit https://example.com");
    const textNode = root.firstChild!;
    placeCaretInTextNode(textNode, (textNode.textContent || "").length);
    autoLinkAtCaret();
    const a = root.querySelector("a");
    expect(a).not.toBeNull();
    expect(a!.getAttribute("href")).toBe("https://example.com");
    expect(a!.getAttribute("target")).toBe("_blank");
    expect(a!.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("prefixes www. URLs with https://", () => {
    const root = setupEditor("see www.example.com");
    const textNode = root.firstChild!;
    placeCaretInTextNode(textNode, (textNode.textContent || "").length);
    autoLinkAtCaret();
    expect(root.querySelector("a")!.getAttribute("href")).toBe(
      "https://www.example.com"
    );
  });

  it("no-ops when no URL precedes the caret", () => {
    const root = setupEditor("plain text");
    const textNode = root.firstChild!;
    placeCaretInTextNode(textNode, (textNode.textContent || "").length);
    autoLinkAtCaret();
    expect(root.querySelector("a")).toBeNull();
  });

  it("no-ops when caret is already inside an <a>", () => {
    const root = setupEditor('<a href="https://x">https://example.com</a>');
    const a = root.querySelector("a")!;
    placeCaretInTextNode(a.firstChild!, (a.textContent || "").length);
    autoLinkAtCaret();
    // No second <a> wrapped inside.
    expect(root.querySelectorAll("a")).toHaveLength(1);
  });
});

describe("handleListTriggerSpace", () => {
  it('converts "1." at line start to an ordered list', () => {
    const root = setupEditor("1.");
    placeCaretInTextNode(root.firstChild!, 2);
    const handled = handleListTriggerSpace(root);
    expect(handled).toBe(true);
    expect(root.querySelector("ol")).not.toBeNull();
    expect(root.querySelector("li")).not.toBeNull();
  });

  it('converts "*" at line start to an unordered list', () => {
    const root = setupEditor("*");
    placeCaretInTextNode(root.firstChild!, 1);
    expect(handleListTriggerSpace(root)).toBe(true);
    expect(root.querySelector("ul")).not.toBeNull();
  });

  it('converts "-" at line start to an unordered list', () => {
    const root = setupEditor("-");
    placeCaretInTextNode(root.firstChild!, 1);
    expect(handleListTriggerSpace(root)).toBe(true);
    expect(root.querySelector("ul")).not.toBeNull();
  });

  it("does not convert when already inside a list", () => {
    const root = setupEditor("<ul><li>1.</li></ul>");
    const li = root.querySelector("li")!;
    placeCaretInTextNode(li.firstChild!, 2);
    expect(handleListTriggerSpace(root)).toBe(false);
  });

  it("does not convert arbitrary text", () => {
    const root = setupEditor("hello");
    placeCaretInTextNode(root.firstChild!, 5);
    expect(handleListTriggerSpace(root)).toBe(false);
  });
});

describe("applyDirToSelection", () => {
  it("sets dir on the wrapped div for an empty editor", () => {
    const root = setupEditor("");
    applyDirToSelection(root, "rtl");
    const div = root.querySelector("div");
    expect(div).not.toBeNull();
    expect(div!.getAttribute("dir")).toBe("rtl");
  });

  it("sets dir on bare text root", () => {
    const root = setupEditor("hello");
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(root);
    sel.removeAllRanges();
    sel.addRange(range);
    applyDirToSelection(root, "rtl");
    // Either root or a wrap div should have rtl.
    const hasDir =
      root.getAttribute("dir") === "rtl" ||
      root.querySelector('[dir="rtl"]') !== null;
    expect(hasDir).toBe(true);
  });
});

describe("readActiveFormatting", () => {
  it("returns default state (LTR) when selection not in root", () => {
    const root = setupEditor("hi");
    const result = readActiveFormatting(root);
    // Direction defaults to ltr so the LTR button reads as selected.
    expect(result).toMatchObject({ bold: false, underline: false, dir: "ltr" });
  });

  it("reads dir attribute from block ancestor", () => {
    const root = setupEditor('<div dir="rtl">hello</div>');
    const div = root.querySelector("div")!;
    placeCaretInTextNode(div.firstChild!, 1);
    expect(readActiveFormatting(root).dir).toBe("rtl");
  });
});

describe("applyFontSize / readActiveFontSize", () => {
  const selectAll = (root: HTMLElement) => {
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(root);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  it("wraps the selection in a span with the given px size", () => {
    const root = setupEditor("hello");
    selectAll(root);
    applyFontSize(root, 24);
    const span = root.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.style.fontSize).toBe("24px");
    expect(span!.textContent).toBe("hello");
  });

  it("reads the active font size from an ancestor span", () => {
    const root = setupEditor('<span style="font-size:20px">hi</span>');
    const span = root.querySelector("span")!;
    placeCaretInTextNode(span.firstChild!, 1);
    expect(readActiveFontSize(root)).toBe(20);
  });

  it("defaults when no explicit size is set", () => {
    const root = setupEditor("plain");
    placeCaretInTextNode(root.firstChild!, 2);
    expect(readActiveFontSize(root)).toBe(DEFAULT_FONT_SIZE);
  });
});
