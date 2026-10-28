import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendAgentMessage, type AgentProposal } from "../../services/agent";
import { capitalizeWords } from "../../utility/dayCalendar";
import { lsCache } from "../../hooks/useLocalStorageCache";
import AgentText from "./AgentText";
import { useDictation } from "../../hooks/useDictation";
import DatePicker from "../DatePicker";
import TimePicker from "../TimePicker";
import { studyAlerts, type AlertBlock } from "../../utility/studyAlerts";
import { pickNudge, splitQuickReplies } from "../../utility/nudges";
import { fetchHiddenNudges, mergeHidden, saveHiddenNudges, type HiddenMap } from "../../services/assistantPrefs";

// "expired": restored from storage without an answer. Its data may be stale,
// so it can't be confirmed any more.
type ProposalState = "pending" | "saving" | "saved" | "dismissed" | "expired";

interface Card {
  proposal: AgentProposal;
  // Bound to the semester open when it was proposed, not the current one.
  year: number;
  semester: string;
  state: ProposalState;
  // The planner task this card is about: the proposal's id, or the id a new
  // task got when it was added. Lets the card follow later changes.
  taskId?: string;
  // The user's own changes to the suggestion, made on the card before saving.
  edits?: TaskDetails;
  editing?: boolean;
}

type TaskDetails = { name?: string; dueDate?: string; startTime?: string; endTime?: string };

// The suggestion with the user's edits applied. An emptied time field
// removes that time.
const withEdits = (c: { proposal: AgentProposal; edits?: TaskDetails }): AgentProposal => {
  const p = { ...c.proposal, ...c.edits };
  if (!p.startTime) delete p.startTime;
  if (!p.endTime) delete p.endTime;
  return p;
};

// A start without an end (or the reverse) is incomplete: the card asks for
// the rest instead of the agent guessing.
const missingDetails = (p: AgentProposal) => !!p.startTime !== !!p.endTime;

// A course's final exam date is optional, but the card opens its field when
// it's missing so it's easy to add.
const needsInput = (kind: CardKind, p: AgentProposal) =>
  kind === "course"
    ? !p.dueDate
    : kind === "block"
      ? !p.dueDate || !p.startTime || !p.endTime
      : !p.dueDate || missingDetails(p);

const detailsProblem = (p: AgentProposal): string | null => {
  if (!p.name.trim()) return "Add a name.";
  if (p.action === "course") {
    if (/[/]/.test(p.name)) return "A course name can't contain /.";
    return p.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? "Pick a valid date." : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)) return "Pick a date.";
  // A study session in the Schedule needs both ends.
  if (p.action === "block" && !p.startTime) return "Pick a start time.";
  if (p.action === "block" && !p.endTime) return "Pick an end time.";
  if (missingDetails(p)) return p.startTime ? "Pick an end time." : "Pick a start time.";
  if (p.startTime && p.endTime && p.endTime <= p.startTime) return "End time must be after the start.";
  return null;
};

// A task as the planner has it now, for keeping cards current.
export interface LiveTask {
  id: string;
  name: string;
  course: string;
  dueDate: string;
  startTime?: string;
  endTime?: string;
  status: string;
  study?: boolean;
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
  // Resolves with the id of the task it saved.
  onConfirm: (p: AgentProposal, year: number, semester: string) => Promise<string | void>;
  // The open semester's tasks once loaded; undefined while loading, so cards
  // don't flash "no longer in your planner".
  liveTasks?: { year: number; semester: string; tasks: LiveTask[] };
  // localStorage key for the last conversation, per user. Sign-out clears
  // every oplanner.* key. Omit to keep the chat in memory only.
  storageKey?: string;
  // Called after New chat with a function that brings the chat back.
  onCleared?: (undo: () => void) => void;
  // The Schedule, so the empty screen can warn about deadlines with no
  // study time planned.
  blocks?: AlertBlock[];
  // The signed-in user, to keep put-away alerts and nudges in step across
  // their devices. Omit to keep them on this device only.
  uid?: string;
}

const MAX_STORED = 40;
const MAX_SENT = 50;
const MAX_NUDGES = 100;

// "HH:MM" plus minutes, kept within the day.
const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + mins));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// The app's own date picker, with a trigger that sits in the card's fields.
const DateField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  value,
  onChange,
  placeholder = "Pick a date",
}) => (
  <DatePicker value={value || null} onChange={(v) => onChange(v ?? "")} block>
    {(open) => (
      <button type="button" className="rs-agent-date" onClick={open}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={value ? "" : "rs-agent-date-empty"}>
          {value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : placeholder}
        </span>
      </button>
    )}
  </DatePicker>
);

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

// Shown on the empty chat only; tapping one sends it as is. One ending in
// "..." needs the student to finish it, so it goes into the input instead.
const SUGGESTIONS: { text: string; icon: React.ReactNode }[] = [
  { text: "בוא נתכנן את השבוע הקרוב", icon: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4M9 14.5l2 2 4-4" /></> },
  { text: "מה יש לי השבוע?", icon: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { text: "תיצור לי קורס חדש בשם...", icon: <path d="M12 5v14M5 12h14" /> },
  { text: "מה פספסתי?", icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 16h.01" /></> },
];

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const formatTime = (p: { startTime?: string; endTime?: string }) =>
  p.startTime ? (p.endTime ? `${p.startTime}–${p.endTime}` : p.startTime) : "";

// Fields an edit changes, old against new, so the student sees exactly what
// Confirm will do (a task name can carry injected instructions).
const editChanges = (p: AgentProposal): { label: string; from: string; to: string }[] => {
  const prev = p.prev;
  if (!prev) return [];
  const timeOf = (t: { startTime?: string; endTime?: string }) =>
    t.startTime ? (t.endTime ? `${t.startTime}–${t.endTime}` : t.startTime) : "No time";
  const statusOf = (s: string) => (s === "DONE" || s === "COMPLETED" ? "Done" : "Pending");
  const rows = [
    { label: "Course", from: capitalizeWords(prev.course), to: capitalizeWords(p.course) },
    { label: "Name", from: prev.name, to: p.name },
    { label: "Date", from: prev.dueDate ? formatDate(prev.dueDate) : "None", to: formatDate(p.dueDate) },
    { label: "Time", from: timeOf(prev), to: timeOf(p) },
    { label: "Status", from: statusOf(prev.status), to: statusOf(p.status) },
  ];
  return rows.filter((r) => r.from !== r.to);
};

type CardKind = "new" | "edit" | "done" | "delete" | "course" | "block";

// A status-only change to Done gets its own card: it's the most common edit.
const cardKind = (p: AgentProposal): CardKind => {
  if (p.action === "delete") return "delete";
  if (p.action === "course") return "course";
  if (p.action === "block") return "block";
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
    label: "Edit task", action: "Save", working: "Saving…", doneText: "Changes saved",
    icon: <svg {...ICON_PROPS}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /></svg>,
  },
  done: {
    label: "Mark as done", action: "Mark done", working: "Saving…", doneText: "Marked as done",
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></svg>,
  },
  course: {
    label: "New course", action: "Add course", working: "Adding…", doneText: "Course added",
    icon: <svg {...ICON_PROPS}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /><path d="M9 7h6" /></svg>,
  },
  block: {
    label: "Study session", action: "Add", working: "Adding…", doneText: "Added to your tasks",
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  },
  delete: {
    label: "Delete task", action: "Delete", working: "Deleting…", doneText: "Deleted",
    icon: <svg {...ICON_PROPS}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>,
  },
};

// What the student did with each card, appended to that reply in the
// history the agent gets. Without it the agent only sees its own text and
// can't tell a dismissed suggestion from one still waiting.
const OUTCOME: Record<ProposalState, string> = {
  pending: "not answered yet",
  saving: "being saved",
  saved: "accepted and saved",
  dismissed: "dismissed",
  expired: "expired, not saved",
};

const cardNotes = (cards: Card[]): string =>
  cards
    .map((c) => {
      const p = withEdits(c);
      const what = KIND[cardKind(c.proposal)].label.toLowerCase();
      const when = p.dueDate ? ` (${p.dueDate}${p.startTime ? ` ${formatTime(p)}` : ""})` : "";
      return `[App note: the ${what} suggestion "${p.name}"${when} was ${OUTCOME[c.state]}.]`;
    })
    .join("\n");

let nextId = 1;
const reserveIds = (list: Message[]) => {
  for (const m of list) nextId = Math.max(nextId, m.id + 1);
  return list;
};

// Chat with the study agent. Replies render through AgentText, which only
// builds React elements, so a reply can't inject markup, links or images.
const AgentPanel: React.FC<Props> = ({ year, semester, onConfirm, liveTasks, storageKey, onCleared, blocks, uid }) => {
  const [messages, setMessages] = useState<Message[]>(() => reserveIds(loadChat(storageKey)));
  const [input, setInput] = useState("");

  // Messages you sent, newest last, for ↑/↓ recall like a terminal. Kept in
  // this browser only (never Firestore) and across New chat; sign-out
  // clears it with the other oplanner.* keys.
  const sentKey = storageKey ? `${storageKey}.sent` : undefined;
  const [sent, setSent] = useState<string[]>(() => {
    const saved = sentKey ? lsCache.read<unknown>(sentKey) : null;
    return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : [];
  });
  // Position while browsing history (null = editing a fresh message) and
  // the unsent text to come back to.
  const [recall, setRecall] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const lastRecall = useRef(0);
  if (recall !== null) lastRecall.current = recall;

  const remember = (message: string) =>
    setSent((prev) => {
      const next = [...prev.filter((m) => m !== message), message].slice(-MAX_SENT);
      if (sentKey) lsCache.write(sentKey, next);
      return next;
    });

  // ↑ on the first line goes back, ↓ on the last line goes forward and
  // finally returns to the draft. Elsewhere the arrows move the caret.
  const recallKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !sent.length) return false;
    const el = e.currentTarget;
    if (e.key === "ArrowUp" && !el.value.slice(0, el.selectionStart).includes("\n")) {
      const at = recall === null ? sent.length - 1 : Math.max(0, recall - 1);
      if (recall === null) setDraft(input);
      setRecall(at);
      setInput(sent[at]);
      return true;
    }
    if (e.key === "ArrowDown" && recall !== null && !el.value.slice(el.selectionEnd).includes("\n")) {
      const at = recall + 1;
      if (at >= sent.length) {
        setRecall(null);
        setInput(draft);
      } else {
        setRecall(at);
        setInput(sent[at]);
      }
      return true;
    }
    return false;
  };
  // Nudges and alerts put away: "forever" once answered or removed, or the
  // day they come back after "not now".
  const nudgeKey = storageKey ? `${storageKey}.nudges` : undefined;
  const [hidden, setHidden] = useState<Record<string, string>>(() => {
    const saved = nudgeKey ? lsCache.read<unknown>(nudgeKey) : null;
    // Before snoozing existed this was a list of keys put away for good.
    if (Array.isArray(saved))
      return Object.fromEntries(saved.filter((x): x is string => typeof x === "string").map((k) => [k, "forever"]));
    if (!saved || typeof saved !== "object") return {};
    return Object.fromEntries(Object.entries(saved).filter((e): e is [string, string] => typeof e[1] === "string"));
  });
  // The alert or nudge whose close button was tapped, asking when to bring it back.
  const [asking, setAsking] = useState<string | null>(null);
  // Kept here (instant, offline) and on the account (other devices).
  const storeHidden = (next: HiddenMap, sync: boolean) => {
    setHidden(next);
    if (nudgeKey) lsCache.write(nudgeKey, next);
    if (sync && uid) void saveHiddenNudges(uid, next).catch(() => {});
  };

  const hide = (key: string, until: "forever" | "tomorrow") => {
    setAsking(null);
    const now = new Date();
    const today = ymd(now);
    // Drop snoozes that have run out, and keep the newest entries.
    const kept = Object.entries(hidden).filter(([k, v]) => k !== key && (v === "forever" || v > today));
    const value =
      until === "forever" ? "forever" : ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    storeHidden(Object.fromEntries([...kept, [key, value]].slice(-MAX_NUDGES)), true);
  };

  // Pick up what other devices put away: on open, and whenever the app
  // comes back to the front.
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const pull = async () => {
      try {
        const remote = await fetchHiddenNudges(uid);
        if (!alive) return;
        const merged = mergeHidden(remote, hiddenRef.current);
        const same = (a: HiddenMap, b: HiddenMap) =>
          Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
        if (!same(merged, hiddenRef.current)) storeHidden(merged, false);
        // This device had some the account didn't: share them.
        if (!same(merged, remote)) void saveHiddenNudges(uid, merged).catch(() => {});
      } catch {
        // Offline or not allowed: this device's own list still works.
      }
    };
    void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  const isHidden = (key: string) => {
    const v = hidden[key];
    return !!v && (v === "forever" || v > ymd(new Date()));
  };
  const closeNudge = (key: string) => hide(key, "forever");
  const [nudgeSaving, setNudgeSaving] = useState(false);

  const [busy, setBusy] = useState(false);
  // What the agent is doing right now, streamed from the server.
  const [status, setStatus] = useState("Thinking…");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ready = year !== null && !!semester;

  // Like a chat app: a message you send moves up to the top of the log and
  // the reply fills in under it, instead of the view chasing the bottom.
  // `pinned` is that message; the spacer under the log gives it room to
  // reach the top while the reply is still short, and shrinks as it grows.
  const pinned = useRef<number | null>(null);
  const scrollToPin = useRef(false);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [spacer, setSpacer] = useState(0);

  // A restored conversation opens at its end.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const measurePin = () => {
    const el = listRef.current;
    const pin = pinned.current;
    const msg = el && pin !== null ? el.querySelector<HTMLElement>(`[data-msg-id="${pin}"]`) : null;
    if (!el || !msg) {
      setSpacer(0);
      return;
    }
    const pad = getComputedStyle(el);
    const top = Math.max(0, msg.offsetTop - parseFloat(pad.paddingTop));
    const below = (spacerRef.current?.offsetTop ?? el.scrollHeight) - top;
    // Exactly enough room for the message to reach the top and no more, so
    // scrolling stops with its top edge at the top of the log.
    setSpacer(Math.max(0, el.clientHeight - below - parseFloat(pad.paddingBottom)));
    if (scrollToPin.current) {
      scrollToPin.current = false;
      const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => {
        if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
        else el.scrollTop = top;
      });
    }
  };
  const measureRef = useRef(measurePin);
  useLayoutEffect(() => {
    measureRef.current = measurePin;
    measurePin();
  });
  // The log's height changes too (a nudge above the input opens or closes).
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    if (messages.length) lsCache.write(storageKey, messages.slice(-MAX_STORED));
    else lsCache.remove(storageKey);
  }, [messages, storageKey]);

  const clearChat = () => {
    pinned.current = null;
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
    if (input) el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // `base` is the conversation to continue from; a retry passes the log
  // without the failed turn so it isn't sent twice.
  const pickSuggestion = (s: string) => {
    if (!s.endsWith("...")) {
      void send(s);
      return;
    }
    const text = s.slice(0, -3) + " ";
    setInput(text);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(text.length, text.length);
    });
  };

  // Talk instead of typing: what's heard goes into the field (after
  // anything already typed) to check and send as usual.
  const dictationBase = useRef("");
  // Why dictation stopped, shown over the field for a few seconds.
  const [dictationNote, setDictationNote] = useState<string | null>(null);
  useEffect(() => {
    if (!dictationNote) return;
    const t = setTimeout(() => setDictationNote(null), 6000);
    return () => clearTimeout(t);
  }, [dictationNote]);
  const dictation = useDictation(
    (heard) => {
      setInput(dictationBase.current + heard);
      setRecall(null);
    },
    setDictationNote
  );
  const toggleDictation = () => {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    dictationBase.current = input.trim() ? `${input.trimEnd()} ` : "";
    setDictationNote(null);
    dictation.start();
    inputRef.current?.focus();
  };

  const send = async (text: string, base: Message[] = messages) => {
    const message = text.trim();
    if (!message || busy || !ready) return;
    dictation.stop();
    // Error notices are local only; the model never sees them.
    const history = base
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, text: m.cards?.length ? `${m.text}\n\n${cardNotes(m.cards)}` : m.text }));
    const sentId = nextId++;
    pinned.current = sentId;
    scrollToPin.current = true;
    setMessages([...base, { id: sentId, role: "user", text: message }]);
    setInput("");
    setRecall(null);
    remember(message);
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

  const setCardState = (msgId: number, index: number, state: ProposalState, taskId?: string) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.cards
          ? {
              ...m,
              cards: m.cards.map((c, i) => (i === index ? { ...c, state, ...(taskId ? { taskId } : {}) } : c)),
            }
          : m
      )
    );

  const confirm = async (msgId: number, index: number, card: Card) => {
    setCardState(msgId, index, "saving");
    try {
      const savedId = await onConfirm(withEdits(card), card.year, card.semester);
      setCardState(msgId, index, "saved", savedId || card.proposal.id);
    } catch {
      setCardState(msgId, index, "pending");
    }
  };

  const setCardEdits = (msgId: number, index: number, patch: TaskDetails, editing?: boolean) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.cards
          ? {
              ...m,
              cards: m.cards.map((c, i) =>
                i === index ? { ...c, edits: { ...c.edits, ...patch }, ...(editing !== undefined ? { editing } : {}) } : c
              ),
            }
          : m
      )
    );

  // Follow a card's task in the planner when its semester is the one loaded.
  // A deleted task makes the card read as gone (except a delete that was
  // confirmed); a saved card shows the task as it is now.
  const track = (c: Card): { live?: LiveTask; gone: boolean } => {
    const id = c.taskId ?? c.proposal.id;
    if (!id || !liveTasks || liveTasks.year !== c.year || liveTasks.semester !== c.semester) return { gone: false };
    const live = liveTasks.tasks.find((t) => t.id === id);
    return { live, gone: !live && !(cardKind(c.proposal) === "delete" && c.state === "saved") };
  };
  const isGone = (c: Card) => track(c).gone;

  // One at a time, so each card shows its own result.
  // Deletes are left out: each needs its own click, so text injected into a
  // task name can't turn one click into several deletions.
  const confirmAll = async (msgId: number, cards: Card[]) => {
    for (const [i, c] of cards.entries()) {
      const k = cardKind(c.proposal);
      if (k === "delete") continue;
      const blocked = (k === "new" || k === "edit" || k === "course" || k === "block") && detailsProblem(withEdits(c));
      if (c.state === "pending" && !isGone(c) && !blocked) await confirm(msgId, i, c);
    }
  };

  const nudge =
    ready && liveTasks && liveTasks.year === year && liveTasks.semester === semester
      ? pickNudge(liveTasks.tasks, new Date(), new Set(Object.keys(hidden).filter(isHidden)))
      : null;

  // "Yes, done" marks the task done right away; the toast says so.
  const markSubmitted = async (key: string, t: LiveTask) => {
    if (year === null || !semester) return;
    setNudgeSaving(true);
    try {
      await onConfirm(
        {
          id: t.id,
          course: t.course,
          name: t.name,
          dueDate: t.dueDate,
          ...(t.startTime ? { startTime: t.startTime } : {}),
          ...(t.endTime ? { endTime: t.endTime } : {}),
          status: "DONE",
        },
        year,
        semester
      );
      closeNudge(key);
    } catch {
      // The toast already explained; leave the question up to try again.
    } finally {
      setNudgeSaving(false);
    }
  };

  // The newest reply's quick answers, while nothing else has been said.
  const last = messages[messages.length - 1];
  // The Assistant asks one question at a time; its likely answers are one
  // tap each, and "Other" is just the field below.
  const quickReplies =
    last?.role === "assistant" && !last.error ? (splitQuickReplies(last.text).groups.at(-1)?.options ?? []) : [];
  const typeOwn = () => requestAnimationFrame(() => inputRef.current?.focus());

  // Asked after the close button: bring it back tomorrow, or never.
  const snoozeChoice = (key: string) => (
    <div className="rs-agent-snooze" dir="rtl">
      <span className="rs-agent-snooze-q">להזכיר לך שוב?</span>
      <button type="button" className="rs-agent-nudge-btn is-primary" onClick={() => hide(key, "tomorrow")}>
        מחר
      </button>
      <button type="button" className="rs-agent-nudge-btn" onClick={() => hide(key, "forever")}>
        לא להזכיר
      </button>
    </div>
  );

  // The card's top-left corner: close, which then turns into "back" while
  // it asks when to bring the card back.
  const cornerButton = (key: string) =>
    asking === key ? (
      <button type="button" className="rs-agent-corner" onClick={() => setAsking(null)} aria-label="ביטול" title="ביטול">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 14l-5-5 5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>
    ) : (
      <button type="button" className="rs-agent-corner" onClick={() => setAsking(key)} aria-label="Close" title="Close">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    );

  return (
    <div className="rs-agent">
      {messages.length > 0 && (
        <div className="rs-agent-head">
          <button
            type="button"
            className="rs-agent-clear"
            onClick={clearChat}
            disabled={busy}
            aria-label="New chat"
            title="New chat"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12" />
              <path d="M18.4 3.6a2 2 0 0 1 2.9 2.9L13 14.8l-3.6.8.8-3.6z" />
            </svg>
          </button>
        </div>
      )}

      <div className="rs-agent-log" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="rs-agent-intro">
            <div className="rs-agent-hello">
              <span className="rs-agent-mark" aria-hidden="true">
                {/* Two sparks, the familiar sign for an AI helper, filled
                    with a quiet green-to-violet light. */}
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
                  <defs>
                    <linearGradient id="rs-spark-fill" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#7ee2a8" />
                      <stop offset="1" stopColor="#a99bff" />
                    </linearGradient>
                  </defs>
                  <path
                    className="rs-agent-mark-spark"
                    d="M10 4C10.7 8.6 12.4 10.3 17 11C12.4 11.7 10.7 13.4 10 18C9.3 13.4 7.6 11.7 3 11C7.6 10.3 9.3 8.6 10 4Z"
                    fill="url(#rs-spark-fill)"
                  />
                  <path
                    className="rs-agent-mark-spark rs-agent-mark-spark-sm"
                    d="M18 14.5C18.3 16.4 19.1 17.2 21 17.5C19.1 17.8 18.3 18.6 18 20.5C17.7 18.6 16.9 17.8 15 17.5C16.9 17.2 17.7 16.4 18 14.5Z"
                    fill="url(#rs-spark-fill)"
                  />
                </svg>
              </span>
              <p className="rs-agent-title">{ready ? "Ask about your semester" : "Open a semester first"}</p>
              <div className="rs-agent-chips" dir="rtl">
                {SUGGESTIONS.map(({ text, icon }, i) => (
                  <button
                    key={text}
                    type="button"
                    className="rs-agent-chip"
                    style={{ animationDelay: `${120 + i * 55}ms` }}
                    onClick={() => pickSuggestion(text)}
                    disabled={!ready || busy}
                  >
                    <span className={`rs-agent-chip-icon${i % 2 ? " rs-agent-chip-icon-alt" : ""}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {icon}
                      </svg>
                    </span>
                    <span className="rs-agent-chip-text">{text}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} data-msg-id={m.id} className={`rs-agent-msg rs-agent-${m.role}${m.error ? " rs-agent-error" : ""}`}>
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
                  <AgentText text={splitQuickReplies(m.text).text} />
                ) : (
                  <p className="rs-agent-text" dir="auto">{m.text}</p>
                )
              )}
              {m === last && quickReplies.length > 0 && (
                <div className="rs-agent-quick" dir="auto">
                  {quickReplies.map((r, i) => (
                    <button
                      key={r}
                      type="button"
                      className="rs-agent-quick-btn"
                      style={{ animationDelay: `${80 + i * 50}ms` }}
                      onClick={() => void send(r)}
                      disabled={busy || !ready}
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rs-agent-quick-btn is-other"
                    style={{ animationDelay: `${80 + quickReplies.length * 50}ms` }}
                    onClick={typeOwn}
                    disabled={busy || !ready}
                  >
                    אחר…
                  </button>
                </div>
              )}
              {m.cards?.map((c, i) => {
                const changes = editChanges(c.proposal);
                const kind = cardKind(c.proposal);
                const k = KIND[kind];
                const { live, gone } = track(c);
                const proposed = withEdits(c);
                const shown = c.state === "saved" && live ? { ...proposed, ...live } : proposed;
                const editable = kind === "new" || kind === "edit" || kind === "course" || kind === "block";
                const problem = editable ? detailsProblem(proposed) : null;
                const actionable = (c.state === "pending" || c.state === "saving") && !gone;
                return (
                <div key={i} className={`rs-agent-card rs-agent-card-${c.state} rs-agent-card-${kind}`}>
                  <div className="rs-agent-card-head">
                    <span className="rs-agent-card-icon" aria-hidden="true">{k.icon}</span>
                    <div className="rs-agent-card-body">
                      <span className="rs-agent-card-kind">
                        {k.label}
                        {/* Cards write to the semester they were proposed in. */}
                        {(c.year !== year || c.semester !== semester) && ` · ${c.semester} ${c.year}`}
                      </span>
                      {/* <bdi> keeps Hebrew names from reordering the English around them. */}
                      <span className="rs-agent-card-name"><bdi>{shown.name}</bdi></span>
                      {kind === "course" ? (
                        <span className="rs-agent-card-meta">
                          {shown.dueDate ? `Final exam ${formatDate(shown.dueDate)}` : "No final exam date"}
                        </span>
                      ) : (
                        <>
                          {shown.course && (
                            <span className="rs-agent-card-meta">
                              <bdi>{capitalizeWords(shown.course)}</bdi>
                            </span>
                          )}
                          <span className="rs-agent-card-meta">
                            {shown.dueDate ? formatDate(shown.dueDate) : "No date yet"}
                            {formatTime(shown) && <span className="rs-agent-card-time">{formatTime(shown)}</span>}
                            {(shown.status === "DONE" || shown.status === "COMPLETED") && <span className="rs-agent-card-time">Done</span>}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {kind === "edit" && !gone && c.state !== "saved" && (
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
                  {gone && (
                    <span className="rs-agent-card-status">No longer in your planner</span>
                  )}
                  {c.state === "saved" && !gone && (
                    <span className="rs-agent-card-status rs-agent-card-status-ok">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {k.doneText}
                    </span>
                  )}
                  {c.state === "dismissed" && (
                    <span className="rs-agent-card-status">
                      Dismissed
                      {!gone && (
                        <button
                          type="button"
                          className="rs-agent-card-undo"
                          onClick={() => setCardState(m.id, i, "pending")}
                        >
                          Undo
                        </button>
                      )}
                    </span>
                  )}
                  {c.state === "expired" && (
                    <span className="rs-agent-card-status">Expired. Ask again for a fresh suggestion.</span>
                  )}
                  {actionable && kind === "course" && (c.editing || needsInput(kind, proposed) || problem) && (
                    <div className="rs-agent-fields">
                      <label className="rs-agent-field rs-agent-field-wide">
                        <span>Name</span>
                        <input
                          type="text"
                          dir="auto"
                          maxLength={100}
                          value={proposed.name}
                          onChange={(e) => setCardEdits(m.id, i, { name: e.target.value })}
                        />
                      </label>
                      <div className="rs-agent-field rs-agent-field-wide">
                        <span>Final exam (optional)</span>
                        <DateField
                          value={proposed.dueDate}
                          onChange={(v) => setCardEdits(m.id, i, { dueDate: v })}
                          placeholder="No date"
                        />
                      </div>
                      {problem && <p className="rs-agent-fields-hint">{problem}</p>}
                    </div>
                  )}
                  {actionable && editable && kind !== "course" && (c.editing || needsInput(kind, proposed) || problem) && (
                    <div className="rs-agent-fields">
                      <label className="rs-agent-field rs-agent-field-wide">
                        <span>Name</span>
                        <input
                          type="text"
                          dir="auto"
                          maxLength={120}
                          value={proposed.name}
                          onChange={(e) => setCardEdits(m.id, i, { name: e.target.value })}
                        />
                      </label>
                      <div className={`rs-agent-field rs-agent-field-wide${!proposed.dueDate ? " rs-agent-field-missing" : ""}`}>
                        <span>Date</span>
                        <DateField value={proposed.dueDate} onChange={(v) => setCardEdits(m.id, i, { dueDate: v })} />
                      </div>
                      <div className={`rs-agent-field${!proposed.startTime && proposed.endTime ? " rs-agent-field-missing" : ""}`}>
                        <label htmlFor={`rs-start-${m.id}-${i}`}>Start</label>
                        <TimePicker
                          id={`rs-start-${m.id}-${i}`}
                          value={proposed.startTime ?? ""}
                          placeholder="--:--"
                          step={15}
                          onChange={(v) => {
                            // Moving the start keeps the length (or 30 minutes
                            // when there's no sensible end yet).
                            const { startTime: from, endTime: to } = proposed;
                            const keep = from && to && to > from ? minutesOf(to) - minutesOf(from) : 30;
                            const end = v && (!to || to <= v || (from && to > from)) ? addMinutes(v, keep) : to;
                            setCardEdits(m.id, i, { startTime: v, ...(end !== undefined ? { endTime: end } : {}) });
                          }}
                        />
                      </div>
                      <div className={`rs-agent-field${proposed.startTime && !proposed.endTime ? " rs-agent-field-missing" : ""}`}>
                        <label htmlFor={`rs-end-${m.id}-${i}`}>End</label>
                        <TimePicker
                          id={`rs-end-${m.id}-${i}`}
                          value={proposed.endTime ?? ""}
                          placeholder="--:--"
                          step={15}
                          showDurationFrom={proposed.startTime || undefined}
                          minTime={proposed.startTime ? addMinutes(proposed.startTime, 14) : undefined}
                          onChange={(v) => setCardEdits(m.id, i, { endTime: v })}
                        />
                      </div>
                      {problem && <p className="rs-agent-fields-hint">{problem}</p>}
                    </div>
                  )}
                  {actionable && (
                    <div className="rs-agent-card-actions">
                      <button
                        type="button"
                        className="rs-agent-btn"
                        onClick={() => setCardState(m.id, i, "dismissed")}
                        disabled={c.state === "saving"}
                      >
                        Dismiss
                      </button>
                      {editable && !c.editing && !needsInput(kind, proposed) && !problem && (
                        <button
                          type="button"
                          className="rs-agent-btn"
                          onClick={() => setCardEdits(m.id, i, {}, true)}
                          disabled={c.state === "saving"}
                        >
                          Edit
                        </button>
                      )}
                      {/* Closes the fields and keeps the changes. Shown once
                          the details are complete; until then they stay open. */}
                      {editable && c.editing && !needsInput(kind, proposed) && !problem && (
                        <button
                          type="button"
                          className="rs-agent-btn"
                          onClick={() => setCardEdits(m.id, i, {}, false)}
                          disabled={c.state === "saving"}
                        >
                          Done
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rs-agent-btn ${kind === "delete" ? "rs-agent-btn-danger" : "rs-agent-btn-primary"}`}
                        onClick={() => void confirm(m.id, i, c)}
                        disabled={c.state === "saving" || !!problem}
                      >
                        {c.state === "saving" ? k.working : k.action}
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
              {(() => {
                const pending =
                  m.cards?.filter(
                    (c) => c.state === "pending" && !isGone(c) && cardKind(c.proposal) !== "delete"
                  ) ?? [];
                if (pending.length < 2) return null;
                const allNew = pending.every((c) => ["new", "course", "block"].includes(cardKind(c.proposal)));
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
        {messages.length > 0 && (
          <div ref={spacerRef} className="rs-agent-spacer" style={{ height: spacer }} aria-hidden="true" />
        )}
      </div>

      {/* Everything the Assistant brings up on its own, stacked right above
          the input with one spacing: early warnings (empty chat only; each
          opens a planning conversation) and the nudge. */}
      <div className="rs-agent-dock">
        {messages.length === 0 && ready && liveTasks && (() => {
          const alerts = studyAlerts(liveTasks.tasks, blocks ?? [], new Date(), 20)
            .filter((a) => !isHidden(a.key))
            // One at a time: the next slides in once this one is planned or put away.
            .slice(0, 1);
          return alerts.length > 0 ? (
            <div className="rs-agent-risks" dir="rtl">
              {alerts.map((a) => (
                // Same card as the nudge below, in the warning color.
                <div key={a.key} className="rs-agent-nudge is-warn" dir="rtl" role="status">
                  <span className="rs-agent-nudge-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4M12 17h.01" />
                      <path d="M10.3 3.9L2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    </svg>
                  </span>
                  <div className="rs-agent-nudge-body">
                    {asking === a.key ? (
                      snoozeChoice(a.key)
                    ) : (
                      <>
                        <p className="rs-agent-nudge-text">
                          <span className="rs-agent-nudge-kicker">{a.label}</span>
                          {a.title}
                        </p>
                        <div className="rs-agent-nudge-actions">
                          <button
                            type="button"
                            className="rs-agent-nudge-btn is-primary"
                            onClick={() => void send(a.prompt)}
                            disabled={busy}
                          >
                            תכנן לי
                          </button>
                          <button type="button" className="rs-agent-nudge-btn" onClick={() => hide(a.key, "tomorrow")}>
                            לא עכשיו
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {cornerButton(a.key)}
                </div>
              ))}
            </div>
          ) : null;
        })()}
      {nudge && (
        // The Assistant speaking first: one question at a time, right above
        // the input, answered with a tap.
        <div key={nudge.key} className="rs-agent-nudge" dir="rtl" role="status">
          <span className="rs-agent-nudge-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M10 4C10.7 8.6 12.4 10.3 17 11C12.4 11.7 10.7 13.4 10 18C9.3 13.4 7.6 11.7 3 11C7.6 10.3 9.3 8.6 10 4Z" />
              <path d="M18 14.5C18.3 16.4 19.1 17.2 21 17.5C19.1 17.8 18.3 18.6 18 20.5C17.7 18.6 16.9 17.8 15 17.5C16.9 17.2 17.7 16.4 18 14.5Z" />
            </svg>
          </span>
          {asking === nudge.key ? (
            <div className="rs-agent-nudge-body">{snoozeChoice(nudge.key)}</div>
          ) : (
          <div className="rs-agent-nudge-body">
            <p className="rs-agent-nudge-text">{nudge.text}</p>
            <div className="rs-agent-nudge-actions">
              {nudge.kind === "submitted" ? (
                <>
                  <button
                    type="button"
                    className="rs-agent-nudge-btn is-primary"
                    onClick={() => void markSubmitted(nudge.key, nudge.task as LiveTask)}
                    disabled={busy || nudgeSaving}
                  >
                    {nudgeSaving ? "מסמן…" : "כן, סיימתי"}
                  </button>
                  <button
                    type="button"
                    className="rs-agent-nudge-btn"
                    onClick={() => {
                      closeNudge(nudge.key);
                      void send(nudge.catchUp);
                    }}
                    disabled={busy || nudgeSaving}
                  >
                    עוד לא
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="rs-agent-nudge-btn is-primary"
                    onClick={() => {
                      closeNudge(nudge.key);
                      void send("בוא נתכנן את השבוע הקרוב");
                    }}
                    disabled={busy}
                  >
                    בוא נתכנן
                  </button>
                  {/* Comes back tomorrow, while the week still has work. */}
                  <button type="button" className="rs-agent-nudge-btn" onClick={() => hide(nudge.key, "tomorrow")}>
                    לא עכשיו
                  </button>
                </>
              )}
            </div>
          </div>
          )}
          {cornerButton(nudge.key)}
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
          placeholder={ready ? "Ask anything…" : "Open a semester first"}
          value={input}
          disabled={!ready}
          onChange={(e) => {
            setInput(e.target.value);
            setRecall(null);
          }}
          onKeyDown={(e) => {
            if (recallKey(e)) {
              e.preventDefault();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        {sent.length > 0 && (
          // Stays mounted so it can open and close smoothly; keeps showing the
          // last position while it closes.
          <span
            className={`rs-agent-recall${recall !== null ? " is-on" : ""}`}
            aria-hidden={recall === null}
            aria-live="polite"
            aria-label={recall !== null ? `Message ${recall + 1} of ${sent.length}` : undefined}
          >
            History {(recall ?? lastRecall.current) + 1}/{sent.length}
          </span>
        )}
        {dictationNote && (
          // Floats over the conversation, so nothing shifts.
          <p className="rs-agent-dictation" role="alert">
            {dictationNote}
          </p>
        )}
        {dictation.supported && (
          <button
            type="button"
            className={`rs-agent-mic${dictation.listening ? " is-on" : ""}`}
            onClick={toggleDictation}
            disabled={!ready}
            aria-pressed={dictation.listening}
            aria-label={dictation.listening ? "Stop dictation" : "Dictate"}
            title={dictation.listening ? "Stop" : "Speak"}
          >
            {dictation.listening ? (
              // Stop: a rounded square, like a recorder.
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
              </svg>
            )}
          </button>
        )}
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
