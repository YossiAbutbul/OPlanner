import React, { useEffect, useRef, useState } from "react";
import { sendAgentMessage, type AgentProposal } from "../../services/agent";
import { capitalizeWords } from "../../utility/dayCalendar";
import { lsCache } from "../../hooks/useLocalStorageCache";
import AgentText from "./AgentText";

// "expired": restored from storage without an answer. Its data may be stale,
// so it can't be confirmed any more.
type ProposalState = "pending" | "saving" | "saved" | "dismissed" | "expired";

interface Card {
  proposal: AgentProposal;
  // Bound to the semester open when it was proposed, not the current one.
  year: number;
  semester: string;
  state: ProposalState;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  error?: boolean;
  retry?: string;  // errors only: the message to send again
}

interface Props {
  year: number | null;
  semester: string | null;
  onConfirm: (p: AgentProposal, year: number, semester: string) => Promise<void>;
  // localStorage key for the last conversation, per user. Sign-out clears
  // every oplanner.* key. Omit to keep the chat in memory only.
  storageKey?: string;
  // Called after New chat with a function that brings the chat back.
  onCleared?: (undo: () => void) => void;
}

const MAX_STORED = 40;

const isMessage = (m: unknown): m is Message => {
  const x = m as Message;
  return !!x && typeof x.id === "number" && (x.role === "user" || x.role === "assistant") && typeof x.text === "string";
};

// Restores the saved chat. Proposals nobody answered come back expired.
const loadChat = (key: string | undefined): Message[] => {
  const saved = key ? lsCache.read<unknown>(key) : null;
  if (!Array.isArray(saved) || !saved.every(isMessage)) return [];
  return saved.map((m) =>
    m.cards
      ? {
          ...m,
          cards: m.cards.map((c) =>
            c.state === "pending" || c.state === "saving" ? { ...c, state: "expired" as const } : c
          ),
        }
      : m
  );
};

// Shown on the empty chat only; tapping one sends it as is.
const SUGGESTIONS = [
  "What's due this week?",
  "What's overdue?",
  "Plan my study days until finals",
  "Which course needs the most attention?",
  "How long until each final?",
];

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const formatTime = (p: AgentProposal) =>
  p.startTime ? (p.endTime ? `${p.startTime}–${p.endTime}` : p.startTime) : "";

// Fields an edit changes, old against new, so the student sees exactly what
// Confirm will do (a task name can carry injected instructions).
const editChanges = (p: AgentProposal): { label: string; from: string; to: string }[] => {
  const prev = p.prev;
  if (!prev) return [];
  const timeOf = (t: { startTime?: string; endTime?: string }) =>
    t.startTime ? (t.endTime ? `${t.startTime}–${t.endTime}` : t.startTime) : "No time";
  const statusOf = (s: string) => (s === "DONE" ? "Done" : "Pending");
  const rows = [
    { label: "Course", from: capitalizeWords(prev.course), to: capitalizeWords(p.course) },
    { label: "Name", from: prev.name, to: p.name },
    { label: "Date", from: prev.dueDate ? formatDate(prev.dueDate) : "None", to: formatDate(p.dueDate) },
    { label: "Time", from: timeOf(prev), to: timeOf(p) },
    { label: "Status", from: statusOf(prev.status), to: statusOf(p.status) },
  ];
  return rows.filter((r) => r.from !== r.to);
};

type CardKind = "new" | "edit" | "done" | "delete";

// A status-only change to Done gets its own card: it's the most common edit.
const cardKind = (p: AgentProposal): CardKind => {
  if (p.action === "delete") return "delete";
  if (!p.id) return "new";
  const changes = editChanges(p);
  return changes.length === 1 && changes[0].label === "Status" && p.status === "DONE" ? "done" : "edit";
};

const ICON_PROPS = {
  viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
} as const;

const KIND: Record<CardKind, { label: string; action: string; working: string; doneText: string; icon: React.ReactNode }> = {
  new: {
    label: "New task", action: "Add task", working: "Saving…", doneText: "Added to your planner",
    icon: <svg {...ICON_PROPS}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" /></svg>,
  },
  edit: {
    label: "Edit task", action: "Save changes", working: "Saving…", doneText: "Changes saved",
    icon: <svg {...ICON_PROPS}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /></svg>,
  },
  done: {
    label: "Mark as done", action: "Mark done", working: "Saving…", doneText: "Marked as done",
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></svg>,
  },
  delete: {
    label: "Delete task", action: "Delete", working: "Deleting…", doneText: "Deleted",
    icon: <svg {...ICON_PROPS}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>,
  },
};

let nextId = 1;
const reserveIds = (list: Message[]) => {
  for (const m of list) nextId = Math.max(nextId, m.id + 1);
  return list;
};

// Chat with the study agent. Replies render through AgentText, which only
// builds React elements, so a reply can't inject markup, links or images.
const AgentPanel: React.FC<Props> = ({ year, semester, onConfirm, storageKey, onCleared }) => {
  const [messages, setMessages] = useState<Message[]>(() => reserveIds(loadChat(storageKey)));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // What the agent is doing right now, streamed from the server.
  const [status, setStatus] = useState("Thinking…");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ready = year !== null && !!semester;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!storageKey) return;
    if (messages.length) lsCache.write(storageKey, messages.slice(-MAX_STORED));
    else lsCache.remove(storageKey);
  }, [messages, storageKey]);

  const clearChat = () => {
    const snapshot = messages;
    setMessages([]);
    // Undo only while the new chat is still empty, so it never overwrites
    // a conversation started since.
    onCleared?.(() => setMessages((prev) => (prev.length ? prev : snapshot)));
  };

  // Grow the field with its text, one line at rest. Done in JS because
  // `field-sizing` isn't supported everywhere and rows={1} renders taller in
  // some browsers, which knocked the text out of line with the send button.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "";
    if (input) el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // `base` is the conversation to continue from; a retry passes the log
  // without the failed turn so it isn't sent twice.
  const send = async (text: string, base: Message[] = messages) => {
    const message = text.trim();
    if (!message || busy || !ready) return;
    // Error notices are local only; the model never sees them.
    const history = base
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages([...base, { id: nextId++, role: "user", text: message }]);
    setInput("");
    setBusy(true);
    setStatus("Thinking…");
    try {
      const res = await sendAgentMessage({ history, message, year, semester }, setStatus);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          role: "assistant",
          text: res.reply,
          cards: res.proposals.map((proposal) => ({ proposal, year, semester, state: "pending" })),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          role: "assistant",
          text: e instanceof Error ? e.message : "Something went wrong.",
          error: true,
          retry: message,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Drops the failed question and its error notice, then asks again.
  const retry = (errorId: number, text: string) => {
    const at = messages.findIndex((m) => m.id === errorId);
    const prior = messages[at - 1]?.role === "user" ? at - 1 : at;
    void send(text, messages.slice(0, prior));
  };

  const setCardState = (msgId: number, index: number, state: ProposalState) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.cards
          ? { ...m, cards: m.cards.map((c, i) => (i === index ? { ...c, state } : c)) }
          : m
      )
    );

  const confirm = async (msgId: number, index: number, card: Card) => {
    setCardState(msgId, index, "saving");
    try {
      await onConfirm(card.proposal, card.year, card.semester);
      setCardState(msgId, index, "saved");
    } catch {
      setCardState(msgId, index, "pending");
    }
  };

  // One at a time, so each card shows its own result.
  const confirmAll = async (msgId: number, cards: Card[]) => {
    for (const [i, c] of cards.entries()) {
      if (c.state === "pending") await confirm(msgId, i, c);
    }
  };

  return (
    <div className="rs-agent">
      {messages.length > 0 && (
        <div className="rs-agent-head">
          <button type="button" className="rs-agent-clear" onClick={clearChat} disabled={busy}>
            New chat
          </button>
        </div>
      )}

      <div className="rs-agent-log" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="rs-agent-intro">
            <p className="rs-empty-title">Ask about your semester</p>
            <p className="rs-empty-text">
              {ready
                ? "It reads your courses and tasks. Changes it suggests are saved only when you confirm."
                : "Open a semester first."}
            </p>
            <div className="rs-agent-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="rs-agent-chip" onClick={() => void send(s)} disabled={!ready || busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`rs-agent-msg rs-agent-${m.role}${m.error ? " rs-agent-error" : ""}`}>
              {m.error ? (
                <div className="rs-agent-alert" role="alert">
                  <svg className="rs-agent-alert-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4.5M12 16h.01" />
                  </svg>
                  <p className="rs-agent-alert-text" dir="auto">{m.text}</p>
                  {m.retry && (
                    <button
                      type="button"
                      className="rs-agent-alert-retry"
                      onClick={() => retry(m.id, m.retry!)}
                      disabled={busy || !ready}
                    >
                      Try again
                    </button>
                  )}
                </div>
              ) : (
                m.role === "assistant" ? (
                  <AgentText text={m.text} />
                ) : (
                  <p className="rs-agent-text" dir="auto">{m.text}</p>
                )
              )}
              {m.cards?.map((c, i) => {
                const changes = editChanges(c.proposal);
                const kind = cardKind(c.proposal);
                const k = KIND[kind];
                return (
                <div key={i} className={`rs-agent-card rs-agent-card-${c.state} rs-agent-card-${kind}`}>
                  <div className="rs-agent-card-head">
                    <span className="rs-agent-card-icon" aria-hidden="true">{k.icon}</span>
                    <div className="rs-agent-card-body">
                      <span className="rs-agent-card-kind">{k.label}</span>
                      {/* <bdi> keeps Hebrew names from reordering the English around them. */}
                      <span className="rs-agent-card-name"><bdi>{c.proposal.name}</bdi></span>
                      <span className="rs-agent-card-meta">
                        <bdi>{capitalizeWords(c.proposal.course)}</bdi>
                      </span>
                      <span className="rs-agent-card-meta">
                        {formatDate(c.proposal.dueDate)}
                        {formatTime(c.proposal) && <span className="rs-agent-card-time">{formatTime(c.proposal)}</span>}
                        {c.proposal.status === "DONE" && <span className="rs-agent-card-time">Done</span>}
                      </span>
                    </div>
                  </div>
                  {kind === "edit" && (
                    <ul className="rs-agent-card-changes">
                      {changes.length === 0 && <li>No changes</li>}
                      {changes.map((ch) => (
                        <li key={ch.label} className={ch.label === "Course" ? "rs-agent-card-move" : undefined}>
                          <span className="rs-agent-card-change-label">{ch.label}</span>
                          <del><bdi>{ch.from}</bdi></del>
                          <span aria-hidden="true">→</span>
                          <ins><bdi>{ch.to}</bdi></ins>
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.state === "saved" && (
                    <span className="rs-agent-card-status rs-agent-card-status-ok">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {k.doneText}
                    </span>
                  )}
                  {c.state === "dismissed" && <span className="rs-agent-card-status">Dismissed</span>}
                  {c.state === "expired" && (
                    <span className="rs-agent-card-status">Expired. Ask again for a fresh suggestion.</span>
                  )}
                  {(c.state === "pending" || c.state === "saving") && (
                    <div className="rs-agent-card-actions">
                      <button
                        type="button"
                        className="rs-agent-btn"
                        onClick={() => setCardState(m.id, i, "dismissed")}
                        disabled={c.state === "saving"}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className={`rs-agent-btn ${kind === "delete" ? "rs-agent-btn-danger" : "rs-agent-btn-primary"}`}
                        onClick={() => void confirm(m.id, i, c)}
                        disabled={c.state === "saving"}
                      >
                        {c.state === "saving" ? k.working : k.action}
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
              {(() => {
                const pending = m.cards?.filter((c) => c.state === "pending") ?? [];
                if (pending.length < 2) return null;
                const allNew = pending.every((c) => cardKind(c.proposal) === "new");
                return (
                  <button
                    type="button"
                    className="rs-agent-btn rs-agent-btn-all"
                    onClick={() => void confirmAll(m.id, m.cards!)}
                    disabled={m.cards!.some((c) => c.state === "saving")}
                  >
                    {allNew ? `Add all ${pending.length}` : `Confirm all ${pending.length}`}
                  </button>
                );
              })()}
            </div>
          ))
        )}
        {busy && (
          <div className="rs-agent-msg rs-agent-assistant rs-agent-typing" role="status">
            <span className="rs-agent-dots" aria-hidden="true">
              <span /><span /><span />
            </span>
            {/* key restarts the fade so each new step reads as a change. */}
            <span key={status} className="rs-agent-status">{status}</span>
          </div>
        )}
      </div>

      <form
        className="rs-agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="rs-agent-input"
          dir="auto"
          rows={1}
          maxLength={2000}
          placeholder={ready ? "Ask anything about your semester…" : "Open a semester first"}
          value={input}
          disabled={!ready}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" className="rs-agent-send" disabled={!ready || busy || !input.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default AgentPanel;
