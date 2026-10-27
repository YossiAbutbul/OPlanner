import React, { useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import "../css/NotFound.css";

// Shown when the URL path isn't the app root. The app has no client-side
// router, so any path other than the configured base (/, or /OPlanner/ on
// GitHub Pages) is a dead link rather than a real route.
//
// The page is a calendar pad of days that don't exist. The top sheet can be
// torn off: it follows the pointer, rubber-bands back if let go gently, and
// a flick throws it away along its momentum, showing the next impossible day.

const DAYS: [string, number, string][] = [
  ["February", 30, "Neverday"],
  ["February", 31, "Someday"],
  ["February", 32, "Noday"],
  ["Smarch", 13, "Lousy day"],
];

// Where a flick would carry the sheet if nothing stopped it (Apple's
// scroll-deceleration projection), so the throw keeps the hand's speed.
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

const Sheet: React.FC<{ day: [string, number, string] }> = ({ day: [month, num, weekday] }) => (
  <>
    <div className="nf-sheet-rings">
      <span />
      <span />
    </div>
    <div className="nf-sheet-month">{month}</div>
    <div className="nf-sheet-day">{num}</div>
    <div className="nf-sheet-weekday">{weekday}</div>
  </>
);

const NotFound: React.FC = () => {
  const home = import.meta.env.BASE_URL || "/";
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [torn, setTorn] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Tilts with the drag, like paper hanging from its rings.
  const rotate = useTransform(x, [-220, 220], [-18, 18]);

  const top = DAYS[index % DAYS.length];
  const next = DAYS[(index + 1) % DAYS.length];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const far = Math.hypot(info.offset.x, info.offset.y) > 120;
    const fast = Math.hypot(info.velocity.x, info.velocity.y) > 600;
    if (!far && !fast) {
      // Not enough: spring home, carrying the release speed.
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30, velocity: info.velocity.x });
      animate(y, 0, { type: "spring", stiffness: 500, damping: 30, velocity: info.velocity.y });
      return;
    }
    setTorn(true);
    // Throw it where the gesture was heading, at least off the pad.
    const dir = Math.atan2(info.offset.y || 1, info.offset.x || 1);
    const tx = x.get() + project(info.velocity.x) + Math.cos(dir) * 500;
    const ty = y.get() + project(info.velocity.y) + Math.sin(dir) * 500;
    const opts = { type: "tween" as const, duration: 0.45, ease: [0.2, 0.6, 0.4, 1] as const };
    animate(x, tx, opts);
    animate(y, ty, {
      ...opts,
      onComplete: () => {
        x.set(0);
        y.set(0);
        setIndex((i) => i + 1);
        setTorn(false);
      },
    });
  };

  return (
    <div className="nf">
      <div className="nf-bg" aria-hidden />

      <motion.div
        className="nf-stage"
        initial={reduceMotion ? false : { opacity: 0, y: -40, rotate: -8 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 14, mass: 0.9 }}
      >
        {/* Idle float lives on its own layer so it doesn't fight the drag. */}
        <div className="nf-float">
          <div className="nf-pad">
            <span className="nf-sheet nf-sheet-back" aria-hidden />
            {/* The next day waits underneath and rises as the top one goes. */}
            <motion.div
              key={`under${index}`}
              className="nf-sheet nf-sheet-top nf-sheet-under"
              aria-hidden
              initial={false}
              animate={{ scale: torn ? 1 : 0.96, y: torn ? 0 : 6, filter: torn ? "brightness(1)" : "brightness(0.82)" }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <Sheet day={next} />
            </motion.div>
            <motion.div
              key={`top${index}`}
              className="nf-sheet nf-sheet-top nf-sheet-grab"
              style={{ x, y, rotate }}
              drag={!reduceMotion}
              dragElastic={0.9}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              whileDrag={{ scale: 1.03, cursor: "grabbing" }}
              aria-label={`${top[0]} ${top[1]}, a day that doesn't exist`}
              role="img"
            >
              <Sheet day={top} />
            </motion.div>
          </div>
        </div>
        {!reduceMotion && <p className="nf-hint">Drag to tear it off</p>}
      </motion.div>

      <motion.div
        className="nf-copy"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 34 }}
      >
        <span className="nf-code">404</span>
        <h1>This day isn't on any calendar</h1>
        <p>The page you're looking for doesn't exist. Your planner is right where you left it.</p>
        <a href={home} className="nf-btn">
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />
          Back to OPlanner
        </a>
        <code className="nf-path" title={window.location.pathname}>
          {window.location.pathname}
        </code>
      </motion.div>
    </div>
  );
};

export default NotFound;
