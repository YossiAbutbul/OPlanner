import React from "react";

// Renders the small Markdown subset the agent writes: paragraphs, numbered
// and bulleted lists, headings, **bold**, *italic* and `code`. It builds
// React elements and never HTML, so a reply can't inject markup. Links and
// images aren't supported on purpose and stay plain text, so a reply can't
// smuggle data out through a URL.

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ol" | "ul"; items: string[] };

const OL = /^\s*\d+[.)]\s+(.*)$/;
const UL = /^\s*[-*•]\s+(.*)$/;
const H = /^\s*#{1,6}\s+(.*)$/;

export const parseBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const ol = OL.exec(line);
    const list = ol ?? UL.exec(line);
    const h = !list && H.exec(line);
    if (list) {
      const kind = ol ? "ol" : "ul";
      if (last?.kind === kind) last.items.push(list[1]);
      else blocks.push({ kind, items: [list[1]] });
    } else if (h) {
      blocks.push({ kind: "h", text: h[1] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length > 0);
};

// `code` first so its contents stay literal, then **bold**, then *italic*.
// Italic needs non-space just inside the stars, so "2 * 3 * 4" stays as is.
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g;

export const renderInline = (text: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const key = out.length;
    if (m[1] !== undefined) out.push(<code key={key}>{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={key}>{renderInline(m[2])}</strong>);
    else out.push(<em key={key}>{m[3]}</em>);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

// Direction by majority of letters, not the first one: a line like
// "**שם המשימה** (finish the project): today" is English with a Hebrew name,
// and dir="auto" would flip it right-to-left and scramble the order.
const RTL_LETTER = /[֐-׿؀-ۿ]/g;
const LTR_LETTER = /[A-Za-zÀ-ɏ]/g;
export const dirOf = (text: string): "rtl" | "ltr" =>
  (text.match(RTL_LETTER)?.length ?? 0) > (text.match(LTR_LETTER)?.length ?? 0) ? "rtl" : "ltr";

const AgentText: React.FC<{ text: string }> = ({ text }) => (
  <div className="rs-agent-text rs-agent-md">
    {parseBlocks(text).map((b, i) => {
      if (b.kind === "h") return <p key={i} className="rs-agent-md-h" dir={dirOf(b.text)}>{renderInline(b.text)}</p>;
      if (b.kind === "p") {
        return (
          <p key={i} dir={dirOf(b.lines.join(" "))}>
            {b.lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </React.Fragment>
            ))}
          </p>
        );
      }
      const List = b.kind;
      return (
        <List key={i} dir={dirOf(b.items.join(" "))}>
          {b.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </List>
      );
    })}
  </div>
);

export default AgentText;
