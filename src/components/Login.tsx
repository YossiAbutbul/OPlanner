import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  type Variants,
} from "framer-motion";
import { ArrowRight, CalendarClock, CalendarPlus, LayoutGrid } from "lucide-react";
import AuthModal from "./AuthModal";
import AuroraBackground from "./AuroraBackground";
import "../css/Login.css";

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 32 },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// Tilts its child toward the cursor (springy 3D), straightens on leave.
const TiltCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reduceMotion = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18 });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    ry.set(dx * 12);
    rx.set(-dy * 12);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 800 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
};

const DEMO_TASKS = [
  "Problem set 2",
  "Watch lecture 8",
  "Lab report",
  "Quiz prep",
];

// Interactive mini-planner. Checking all tasks fires confetti — the landing
// demos the core loop (check things off, feel good) for real.
const HeroDemo: React.FC = () => {
  const [done, setDone] = useState<boolean[]>(() => [true, false, false, false]);
  const [ringPct, setRingPct] = useState(0);
  const firedRef = useRef(false);

  const completed = done.filter(Boolean).length;
  const pct = Math.round((completed / DEMO_TASKS.length) * 100);

  // Donut sweeps in from 0 on mount, then tracks real progress.
  useEffect(() => {
    const id = setTimeout(() => setRingPct(pct), 350);
    return () => clearTimeout(id);
  }, [pct]);

  useEffect(() => {
    if (pct === 100 && !firedRef.current) {
      firedRef.current = true;
      // canvas-confetti is already an app dependency; lazy-load so the
      // landing chunk stays lean until the moment of glory.
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 140,
          spread: 85,
          origin: { y: 0.55 },
          colors: ["#1db954", "#4ade80", "#3498db", "#9b59b6"],
        });
      });
    }
    if (pct < 100) firedRef.current = false;
  }, [pct]);

  // SVG donut: r=34 → circumference ≈ 213.6
  const C = 2 * Math.PI * 34;

  return (
    <div className="landing-demo" aria-label="Interactive demo">
      <div className="landing-demo-head">
        <span className="landing-dot" style={{ background: "#1db954" }} />
        <span className="landing-demo-course">Algorithms</span>
        <span className="landing-pill">week 9</span>
      </div>

      <div className="landing-demo-body">
        <div className="landing-demo-donut">
          <svg viewBox="0 0 80 80" aria-hidden>
            <circle className="landing-demo-ring-bg" cx="40" cy="40" r="34" />
            <circle
              className="landing-demo-ring"
              cx="40"
              cy="40"
              r="34"
              strokeDasharray={C}
              strokeDashoffset={C - (C * ringPct) / 100}
            />
          </svg>
          <span className="landing-demo-pct">{pct}%</span>
        </div>

        <ul className="landing-demo-list">
          {DEMO_TASKS.map((name, i) => (
            <li key={name}>
              <motion.button
                type="button"
                className={`landing-demo-task ${done[i] ? "done" : ""}`}
                onClick={() =>
                  setDone((d) => d.map((v, j) => (j === i ? !v : v)))
                }
                whileTap={{ scale: 0.96 }}
              >
                <motion.span
                  className="landing-demo-check"
                  aria-hidden
                  animate={
                    done[i]
                      ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.32 }}
                >
                  {done[i] ? "✓" : ""}
                </motion.span>
                <span className="landing-demo-name">{name}</span>
              </motion.button>
            </li>
          ))}
        </ul>
      </div>

      <div className="landing-demo-foot">
        {pct === 100
          ? "That's the feeling. Every time. 🎉"
          : "This card is real - clear the list."}
      </div>
    </div>
  );
};

const FEATURES = [
  {
    icon: CalendarPlus,
    title: "Your whole semester, in one drop",
    text: "Import a single .ics and every course, class and deadline lands in place. Thirty seconds, no typing.",
  },
  {
    icon: LayoutGrid,
    title: "Organised the way you think",
    text: "Years, semesters and courses as colour-coded tabs you already know how to use. Nothing to learn.",
  },
  {
    icon: CalendarClock,
    title: "Never blindsided by a deadline",
    text: "A live countdown to every assignment and final - the honest days left, always in view.",
  },
];

const Login: React.FC = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const reduceMotion = useReducedMotion();

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="landing">
      <AuroraBackground />
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="./Logo.svg" alt="" className="landing-logo" />
          <span>OPlanner</span>
        </div>
        <div className="landing-nav-right">
          <button
            className="landing-nav-btn"
            onClick={() => openAuth("signin")}
          >
            Sign in
          </button>
        </div>
      </nav>

      <main className="landing-main">
        {/* Dark stage — everything important lives on this one screen. */}
        <section className="landing-hero">
          <div className="landing-hero-glow" aria-hidden />
          <div className="landing-hero-inner">
            <motion.div
              className="landing-hero-text"
              variants={reduceMotion ? undefined : stagger}
              initial="hidden"
              animate="show"
            >
              <motion.span className="landing-eyebrow" variants={rise}>
                <span className="landing-eyebrow-dot" /> Free for students
              </motion.span>

              <motion.h1 variants={rise}>
                Every deadline.
                <br />
                <span className="landing-hero-accent">One page.</span>
              </motion.h1>

              <motion.p className="landing-lead" variants={rise}>
                OPlanner turns your university calendar into a live semester
                plan - assignments, finals and the countdown to both.
              </motion.p>

              <motion.div className="landing-cta-row" variants={rise}>
                <button
                  className="landing-cta"
                  onClick={() => openAuth("signin")}
                >
                  Start free
                  <span className="landing-cta-arrow" aria-hidden>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </span>
                </button>
              </motion.div>

              <motion.ul className="landing-points" variants={rise}>
                {FEATURES.map((f) => (
                  <li key={f.title} className="landing-point">
                    <span className="landing-point-icon">
                      <f.icon size={17} strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="landing-point-copy">
                      <strong>{f.title}</strong>
                      <span>{f.text}</span>
                    </span>
                  </li>
                ))}
              </motion.ul>
            </motion.div>

            <motion.div
              className="landing-hero-art"
              initial={reduceMotion ? false : { opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 240,
                damping: 26,
              }}
            >
              <div className="landing-demo-float">
                <TiltCard>
                  <HeroDemo />
                </TiltCard>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>OPlanner · {new Date().getFullYear()}</span>
        <a
          href="https://github.com/YossiAbutbul/OPlanner"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub
        </a>
      </footer>

      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
};

export default Login;
