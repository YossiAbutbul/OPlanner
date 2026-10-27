import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, Sparkles } from "lucide-react";

// The landing hero: a scripted run of the real Assistant. A question is
// typed and sent, the reply comes with a suggestion card, the card is
// added, and the task lands in the Up next card beside it. Two scripts
// alternate in a loop.

interface Script {
  ask: string;
  status: string;
  reply: string;
  card: { kind: string; name: string; meta: string };
  lands: { name: string; meta: string; accent: string };
}

const SCRIPTS: Script[] = [
  {
    ask: "What's due this week?",
    status: "Reading your tasks…",
    reply: "Two things this week. Lab report 3 isn't in your planner yet.",
    card: { kind: "New task", name: "Lab report 3", meta: "Physics · Thu, Oct 30" },
    lands: { name: "Lab report 3", meta: "Physics · Thu", accent: "#4cd980" },
  },
  {
    ask: "Add my Algorithms final on Jan 20",
    status: "Checking your courses…",
    reply: "Here it is. I'll keep the countdown going.",
    card: { kind: "Final exam", name: "Algorithms final", meta: "Tue, Jan 20 · 85 days" },
    lands: { name: "Algorithms final", meta: "Jan 20 · 85 days", accent: "#a99cff" },
  },
];

// Up next always shows three rows: each added task pushes the oldest out,
// so the card keeps its size however long the loop runs.
const UPNEXT_ROWS = 3;
const BASE_UPNEXT = [
  { name: "Problem set 4", meta: "Calculus · Wed", accent: "#5ab0ff" },
  { name: "Read ch. 7", meta: "History · Fri", accent: "#ffb86b" },
  { name: "Quiz prep", meta: "Statistics · Sun", accent: "#ff7a9c" },
];

type Phase = "typing" | "sent" | "thinking" | "reply" | "card" | "pressed" | "added";

// [phase, ms to stay in it]
const TIMELINE: [Phase, number][] = [
  ["typing", 0],
  ["sent", 450],
  ["thinking", 1100],
  ["reply", 700],
  ["card", 1300],
  ["pressed", 260],
  ["added", 3200],
];

type Row = { name: string; meta: string; accent: string };

// Newest first, never the same task twice, and room left for one base row.
const addRow = (rows: Row[], row: Row): Row[] =>
  [row, ...rows.filter((r) => r.name !== row.name)].slice(0, UPNEXT_ROWS - 1);

const AssistantDemo: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "added" : "typing");
  const [typed, setTyped] = useState(0);
  const [landed, setLanded] = useState<Script["lands"][]>(reduceMotion ? [SCRIPTS[0].lands] : []);
  // The task in flight from the chat card to Up next, in demo coordinates.
  const [flight, setFlight] = useState<{ x: number; y: number; dx: number; dy: number; w: number } | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inFlight = useRef(false);

  const script = SCRIPTS[round % SCRIPTS.length];

  // Typewriter for the question, then the rest of the timeline.
  useEffect(() => {
    if (reduceMotion) return;
    // Throws the card's task name into the Up next list; the row appears
    // when it lands. Measured in the demo's own box, so the 3D tilt applies
    // to the chip the same way it applies to both ends.
    const launch = () => {
      const demo = demoRef.current?.getBoundingClientRect();
      const from = nameRef.current?.getBoundingClientRect();
      const to = listRef.current?.getBoundingClientRect();
      if (!demo || !from || !to) {
        setLanded((l) => addRow(l, script.lands));
        return;
      }
      inFlight.current = true;
      setFlight({
        x: from.left - demo.left,
        y: from.top - demo.top,
        dx: to.left + 10 - from.left,
        dy: to.top + 4 - from.top,
        w: from.width,
      });
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    setPhase("typing");
    setTyped(0);
    let t = 600;
    for (let i = 1; i <= script.ask.length; i++) {
      t += 38 + (script.ask[i - 1] === " " ? 40 : 0);
      timers.push(setTimeout(() => setTyped(i), t));
    }
    for (const [p, wait] of TIMELINE.slice(1)) {
      t += wait;
      timers.push(
        setTimeout(() => {
          setPhase(p);
          if (p === "added") launch();
        }, t)
      );
    }
    t += 3200;
    timers.push(
      setTimeout(() => {
        // A new pass through the scripts starts from the original planner,
        // so each task is added fresh rather than already being there.
        if ((round + 1) % SCRIPTS.length === 0) setLanded([]);
        setRound(round + 1);
      }, t)
    );
    return () => timers.forEach(clearTimeout);
  }, [round, reduceMotion, script]);

  // Runs once per flight: the completion callback can fire more than once
  // (once per animated value), so only the first call for a flight lands.
  const land = () => {
    if (!inFlight.current) return;
    inFlight.current = false;
    setFlight(null);
    setLanded((l) => addRow(l, script.lands));
  };

  const at = (p: Phase) => TIMELINE.findIndex(([x]) => x === phase) >= TIMELINE.findIndex(([x]) => x === p);
  const rows = [...landed, ...BASE_UPNEXT.filter((b) => !landed.some((l) => l.name === b.name))].slice(0, UPNEXT_ROWS);

  return (
    <div className="lp-demo" ref={demoRef} aria-label="The Assistant adding a task to the planner" role="img">
      <div className="lp-chat">
        <div className="lp-chat-head">
          <span className="lp-chat-icon">
            <Sparkles size={14} />
          </span>
          AI Assistant
          <span className="lp-chat-live">
            <span className="lp-chat-live-dot" /> live
          </span>
        </div>

        <div className="lp-chat-log">
          <AnimatePresence mode="popLayout">
            {at("sent") && (
              <motion.div
                key={`q${round}`}
                className="lp-bubble lp-bubble-user"
                initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                {script.ask}
              </motion.div>
            )}
            {phase === "thinking" && (
              <motion.div
                key={`s${round}`}
                className="lp-status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
              >
                <span className="lp-dots">
                  <span />
                  <span />
                  <span />
                </span>
                {script.status}
              </motion.div>
            )}
            {at("reply") && (
              <motion.p
                key={`r${round}`}
                className="lp-reply"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
                exit={{ opacity: 0, y: -10 }}
              >
                {script.reply}
              </motion.p>
            )}
            {at("card") && (
              <motion.div
                key={`c${round}`}
                className={`lp-card${at("added") ? " lp-card-added" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                <span className="lp-card-kind">{script.card.kind}</span>
                <span className="lp-card-name" ref={nameRef}>
                  {script.card.name}
                </span>
                <span className="lp-card-meta">{script.card.meta}</span>
                <span className="lp-card-actions">
                  {at("added") ? (
                    <span className="lp-card-done">
                      <Check size={14} strokeWidth={3} /> Added
                    </span>
                  ) : (
                    <>
                      <span className={`lp-card-btn${phase === "pressed" ? " lp-pressed" : ""}`}>Add task</span>
                      <span className="lp-card-btn lp-card-btn-ghost">Edit</span>
                    </>
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lp-chat-input">
          <span className={phase === "typing" ? "lp-typed" : "lp-placeholder"}>
            {phase === "typing" ? script.ask.slice(0, typed) : "Ask about your semester…"}
            {phase === "typing" && <span className="lp-caret" />}
          </span>
          <span className={`lp-send${phase === "typing" && typed === script.ask.length ? " lp-send-ready" : ""}`}>
            <ArrowUp size={14} strokeWidth={2.6} />
          </span>
        </div>
      </div>

      <div className="lp-upnext">
        <div className="lp-upnext-head">
          Up next <span>{rows.length} this week</span>
        </div>
        <ul ref={listRef}>
          {/* popLayout: a leaving row steps out of the flow at once, so the
              card never grows to four rows mid-swap. */}
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((r) => (
              <motion.li
                key={r.name}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, x: -16, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 32 }}
              >
                <span className="lp-upnext-dot" style={{ background: r.accent }} />
                <span className="lp-upnext-name">{r.name}</span>
                <span className="lp-upnext-meta">{r.meta}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <AnimatePresence>
        {flight && (
          <motion.span
            key={`f${round}`}
            className="lp-flight"
            style={{ left: flight.x, top: flight.y }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: flight.dx,
              // Arcs up before dropping in, like it was tossed.
              y: [0, flight.dy * 0.35 - 40, flight.dy],
              scale: [1, 1.08, 0.86],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.3, 0.7, 0.2, 1] }}
            onAnimationComplete={land}
          >
            <span className="lp-upnext-dot" style={{ background: script.lands.accent }} />
            {script.card.name}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantDemo;
