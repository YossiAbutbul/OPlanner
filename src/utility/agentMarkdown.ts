// Parsing for the Markdown subset agent replies use (AgentText renders it).

export type Block =
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

// Direction by majority of letters, not the first one: a line like
// "**שם המשימה** (finish the project): today" is English with a Hebrew name,
// and dir="auto" would flip it right-to-left and scramble the order.
const RTL_LETTER = /[֐-׿؀-ۿ]/g;
const LTR_LETTER = /[A-Za-zÀ-ɏ]/g;
export const dirOf = (text: string): "rtl" | "ltr" =>
  (text.match(RTL_LETTER)?.length ?? 0) > (text.match(LTR_LETTER)?.length ?? 0) ? "rtl" : "ltr";
