import React, { useRef, useState } from "react";
import { motion, useReducedMotion, useMotionValueEvent, useScroll, type Variants } from "framer-motion";
import AuthPanel from "./AuthPanel";
import AssistantDemo from "./AssistantDemo";
import LandingSections from "./LandingSections";
import "../css/Login.css";

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 36 } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// The landing page: sign-in and the pitch up top, then one section per
// thing the app does. Light, on the app's own paper background.
const Login: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });

  // The header is clear over the hero and becomes a bar once content starts
  // passing under it; past the hero it offers a way back up to sign in.
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 12);
    setPastHero(y > (scroller.current?.clientHeight ?? 800) * 0.7);
  });
  const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });

  return (
    <div className="lp" ref={scroller}>
      <div className="lp-bg" aria-hidden />

      <header className={`lp-nav${scrolled ? " lp-nav-solid" : ""}`}>
        <button type="button" className="lp-brand" onClick={toTop}>
          <img src="./Logo.svg" alt="" className="lp-logo" />
          <span>OPlanner</span>
        </button>
        <motion.button
          type="button"
          className="lp-nav-cta"
          onClick={toTop}
          initial={false}
          animate={pastHero ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: 0, y: -6, pointerEvents: "none" }}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          tabIndex={pastHero ? 0 : -1}
        >
          Sign in
        </motion.button>
      </header>

      <main className="lp-main">
        <motion.div
          className="lp-copy"
          variants={reduceMotion ? undefined : stagger}
          initial="hidden"
          animate="show"
        >
          <motion.p className="lp-eyebrow" variants={rise}>
            Free for students · Now with a study assistant
          </motion.p>

          <motion.h1 variants={rise}>
            Your semester,
            <br />
            <span className="lp-accent">all on one page.</span>
          </motion.h1>

          <motion.p className="lp-lead" variants={rise}>
            Courses, assignments and exams in one planner. Import your university calendar, keep
            track of every deadline, and ask the assistant when you need a hand.
          </motion.p>

          <motion.div variants={rise}>
            <AuthPanel />
          </motion.div>
        </motion.div>

        <motion.div
          className="lp-art"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 30 }}
        >
          <AssistantDemo />
        </motion.div>
      </main>

      <LandingSections root={scroller} cta={<AuthPanel />} />

      <footer className="lp-footer">
        <span>OPlanner · {new Date().getFullYear()}</span>
        <a href="https://github.com/YossiAbutbul/OPlanner" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
};

export default Login;
