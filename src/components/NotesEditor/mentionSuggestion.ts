import type { Editor, Range } from "@tiptap/react";
import type { MentionLink } from "../NotesEditor";

// Live getter so the @-picker always sees the current course links even though
// the Mention extension is configured once at editor creation.
type LinksGetter = () => MentionLink[];

interface SuggestionProps {
  editor: Editor;
  range: Range;
  query: string;
  items: MentionLink[];
  command: (item: MentionLink) => void;
  clientRect?: (() => DOMRect | null) | null;
}

// A vanilla popup (no tippy dep): a <ul> appended to <body>, positioned at the
// caret rect. Mirrors the look of the old custom @-mention list.
function buildPopup() {
  const el = document.createElement("ul");
  el.className = "ne-mention-pop";
  el.setAttribute("role", "listbox");
  el.style.position = "fixed";
  document.body.appendChild(el);
  return el;
}

export function makeMentionSuggestion(getLinks: LinksGetter) {
  return {
    // Insert a clickable link chip (same markup/class the old editor produced)
    // in place of the "@query" run, then a trailing space.
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: MentionLink }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "text",
            text: props.label,
            marks: [
              {
                type: "link",
                attrs: {
                  href: props.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  class: "ne-link",
                },
              },
            ],
          },
          { type: "text", text: " " },
        ])
        .run();
    },

    items: ({ query }: { query: string }): MentionLink[] => {
      const q = query.toLowerCase();
      return getLinks()
        .filter((l) => l.label.toLowerCase().includes(q))
        .slice(0, 8);
    },

    render: () => {
      let popup: HTMLUListElement | null = null;
      let items: MentionLink[] = [];
      let selected = 0;
      let onPick: ((item: MentionLink) => void) | null = null;

      const paint = () => {
        if (!popup) return;
        popup.innerHTML = "";
        items.forEach((item, i) => {
          const li = document.createElement("li");
          li.className = `ne-mention-item ${i === selected ? "ne-mention-item-active" : ""}`;
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", String(i === selected));
          li.textContent = item.label;
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            onPick?.(item);
          });
          li.addEventListener("mouseenter", () => {
            selected = i;
            paint();
          });
          popup!.appendChild(li);
        });
      };

      const place = (clientRect?: (() => DOMRect | null) | null) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.style.top = `${rect.bottom + 4}px`;
        popup.style.left = `${rect.left}px`;
      };

      const update = (props: SuggestionProps) => {
        items = props.items;
        onPick = props.command;
        if (selected >= items.length) selected = 0;
        if (items.length === 0) {
          if (popup) popup.style.display = "none";
          return;
        }
        if (popup) popup.style.display = "";
        paint();
        place(props.clientRect);
      };

      return {
        onStart: (props: SuggestionProps) => {
          popup = buildPopup();
          selected = 0;
          update(props);
        },
        onUpdate: (props: SuggestionProps) => {
          update(props);
        },
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (items.length === 0) return false;
          if (event.key === "ArrowDown") {
            selected = (selected + 1) % items.length;
            paint();
            return true;
          }
          if (event.key === "ArrowUp") {
            selected = (selected - 1 + items.length) % items.length;
            paint();
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            onPick?.(items[selected]);
            return true;
          }
          if (event.key === "Escape") {
            popup?.remove();
            popup = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
        },
      };
    },
  };
}
