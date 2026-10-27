import React, { useEffect, useRef, useState } from "react";
import { sendAgentMessage, type AgentProposal } from "../../services/agent";
import { capitalizeWords } from "../../utility/dayCalendar";

type ProposalState = "pending" | "saving" | "saved" | "dismissed";

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
}

// Tapping one sends it as is.
const SUGGESTIONS = [
  "What's due this week?",
  "What's overdue?",
  "Plan my study days until finals",
  "Which course needs the most attention?",
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

let nextId = 1;

// Chat with the study agent. Replies render as plain text (React escapes
// them), so a reply can't inject markup, links or images.
const AgentPanel: React.FC<Props> = ({ year, semester, onConfirm }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const ready = year !== null && !!semester;
  // Once chatting, offer only the suggestions not asked yet.
  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const remaining = SUGGESTIONS.filter((s) => !asked.has(s));

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

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
    try {
      const res = await sendAgentMessage({ history, message, year, semester });
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

  return (
    <div className="rs-agent">
      {messages.length > 0 && (
        <div className="rs-agent-head">
          <button type="button" className="rs-agent-clear" onClick={() => setMessages([])} disabled={busy}>
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
                <p className="rs-agent-text" dir="auto">{m.text}</p>
              )}
              {m.cards?.map((c, i) => {
                const changes = editChanges(c.proposal);
                return (
                <div key={i} className={`rs-agent-card rs-agent-card-${c.state}`}>
                  <span className="rs-agent-card-kind">{c.proposal.id ? "Edit task" : "New task"}</span>
                  {c.proposal.prev && (
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
                  {/* <bdi> keeps Hebrew names from reordering the English around them. */}
                  <span className="rs-agent-card-name"><bdi>{c.proposal.name}</bdi></span>
                  <span className="rs-agent-card-meta">
                    <span className="rs-agent-card-dot" aria-hidden="true" />
                    <bdi>{capitalizeWords(c.proposal.course)}</bdi>
                  </span>
                  <span className="rs-agent-card-meta">
                    {formatDate(c.proposal.dueDate)}
                    {formatTime(c.proposal) && <span className="rs-agent-card-time">{formatTime(c.proposal)}</span>}
                    {c.proposal.status === "DONE" && <span className="rs-agent-card-time">Done</span>}
                  </span>
                  {c.state === "saved" && <span className="rs-agent-card-done">Saved</span>}
                  {c.state === "dismissed" && <span className="rs-agent-card-done">Dismissed</span>}
                  {(c.state === "pending" || c.state === "saving") && (
                    <div className="rs-agent-card-actions">
                      <button
                        type="button"
                        className="rs-agent-btn rs-agent-btn-primary"
                        onClick={() => void confirm(m.id, i, c)}
                        disabled={c.state === "saving"}
                      >
                        {c.state === "saving" ? "Saving…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="rs-agent-btn"
                        onClick={() => setCardState(m.id, i, "dismissed")}
                        disabled={c.state === "saving"}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ))
        )}
        {busy && (
          <div className="rs-agent-msg rs-agent-assistant rs-agent-typing" aria-label="Thinking">
            <span /><span /><span />
          </div>
        )}
      </div>

      {messages.length > 0 && remaining.length > 0 && (
        <div className="rs-agent-chips rs-agent-chips-row">
          {remaining.map((s) => (
            <button key={s} type="button" className="rs-agent-chip" onClick={() => void send(s)} disabled={!ready || busy}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="rs-agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
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
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default AgentPanel;
