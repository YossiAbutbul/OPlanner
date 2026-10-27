import React from "react";
import { dirOf, parseBlocks } from "../../utility/agentMarkdown";

// Renders the small Markdown subset the agent writes: paragraphs, numbered
// and bulleted lists, headings, **bold**, *italic* and `code`. It builds
// React elements and never HTML, so a reply can't inject markup. Links and
// images aren't supported on purpose and stay plain text, so a reply can't
// smuggle data out through a URL.

// `code` first so its contents stay literal, then **bold**, then *italic*.
// Italic needs non-space just inside the stars, so "2 * 3 * 4" stays as is.
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g;

const renderInline = (text: string): React.ReactNode[] => {
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
