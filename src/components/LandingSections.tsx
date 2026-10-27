import React, { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  Bell,
  Check,
  CloudOff,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  MonitorSmartphone,
  MoonStar,
  PartyPopper,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import "../css/LandingSections.css";

// Everything below the hero, one section per thing the app does, each with
// a product shot built from the app's own pieces. Shots settle into place
// (tilt flattens, scale grows) as they scroll in; small details inside them
// play once they're in view.

type Root = React.RefObject<HTMLElement | null>;

const COURSES = [
  { name: "Algorithms", color: "#4cd980" },
  { name: "Physics", color: "#5ab0ff" },
  { name: "Linear Algebra", color: "#a99cff" },
  { name: "History", color: "#ffb86b" },
];

const textIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 170, damping: 26 },
  },
};

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

// Counts up (or down) to `to` once in view.
const Count: React.FC<{ root: Root; from: number; to: number; suffix?: string }> = ({ root, from, to, suffix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { root, once: true, amount: 0.6 });
  const v = useMotionValue(reduceMotion ? to : from);
  const text = useTransform(v, (n) => `${Math.round(n)}${suffix}`);
  useEffect(() => {
    if (!inView || reduceMotion) return;
    const c = animate(v, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, reduceMotion, to, v]);
  return <motion.span ref={ref}>{text}</motion.span>;
};

// The shot frame: tilts back and grows as its section scrolls up to center.
const Shot: React.FC<{ root: Root; children: React.ReactNode; className?: string }> = ({ root, children, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, container: root, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [7, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.85, 1]);
  return (
    <div className="lps-shot-wrap">
      <motion.div
        ref={ref}
        className={`lps-shot ${className ?? ""}`}
        style={reduceMotion ? undefined : { rotateX, scale, opacity, transformPerspective: 1200 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

const Row: React.FC<{
  root: Root;
  id: string;
  kicker: string;
  title: React.ReactNode;
  text: string;
  points?: string[];
  flip?: boolean;
  children: React.ReactNode;
}> = ({ root, id, kicker, title, text, points, flip, children }) => {
  const reduceMotion = useReducedMotion();
  return (
    <section className={`lps-row${flip ? " lps-flip" : ""}`} id={id}>
      <motion.div
        className="lps-copy"
        variants={stagger}
        initial={reduceMotion ? "show" : "hidden"}
        whileInView="show"
        viewport={{ root, once: true, amount: 0.4 }}
      >
        <motion.span className="lps-kicker" variants={textIn}>
          {kicker}
        </motion.span>
        <motion.h2 variants={textIn}>{title}</motion.h2>
        <motion.p variants={textIn}>{text}</motion.p>
        {points && (
          <motion.ul variants={textIn} className="lps-points">
            {points.map((p) => (
              <li key={p}>
                <Check size={14} strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </motion.ul>
        )}
      </motion.div>
      <Shot root={root}>{children}</Shot>
    </section>
  );
};

// ---------------------------------------------------------------- shots

const OverviewShot: React.FC<{ root: Root }> = ({ root }) => (
  <div className="lps-ov">
    <div className="lps-ov-head">
      <strong>Semester A</strong>
      <span>2026</span>
    </div>
    <div className="lps-ov-top">
      <div className="lps-ov-progress">
        <div className="lps-ov-pct">
          <Count root={root} from={0} to={68} suffix="%" />
          <small>complete</small>
        </div>
        <div className="lps-ov-bar">
          <motion.i
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 0.68 }}
            viewport={{ root, once: true }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="lps-ov-stats">
          <span>
            Completed
            <b className="ok">
              <Count root={root} from={0} to={17} />
            </b>
          </span>
          <span>
            Pending
            <b className="warn">
              <Count root={root} from={0} to={6} />
            </b>
          </span>
          <span>
            Overdue
            <b className="bad">
              <Count root={root} from={0} to={1} />
            </b>
          </span>
        </div>
      </div>
      <div className="lps-ov-next">
        <small>Up next</small>
        {[
          ["Problem set 4", "Algorithms", "Tue", COURSES[0].color],
          ["Lab report 3", "Physics", "Thu", COURSES[1].color],
          ["Quiz 2", "Linear Algebra", "Sun", COURSES[2].color],
        ].map(([name, course, day, color]) => (
          <div key={name} className="lps-ov-task">
            <i style={{ background: color }} />
            <span>
              {name}
              <em>{course}</em>
            </span>
            <b>{day}</b>
          </div>
        ))}
      </div>
    </div>
    <div className="lps-ov-bottom">
      <div className="lps-ov-cal">
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} className={i === 17 ? "today" : ""}>
            {[4, 9, 12, 19, 23, 26, 30].includes(i) && <i style={{ background: COURSES[i % 4].color }} />}
          </span>
        ))}
      </div>
      <div className="lps-ov-finals">
        <small>Finals countdown</small>
        {[
          ["Algorithms", 42, COURSES[0].color],
          ["Physics", 57, COURSES[1].color],
          ["Linear Algebra", 63, COURSES[2].color],
        ].map(([name, days, color]) => (
          <div key={name as string}>
            <i style={{ background: color as string }} />
            <span>{name}</span>
            <b>
              <Count root={root} from={120} to={days as number} /> days
            </b>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ImportShot: React.FC<{ root: Root }> = ({ root }) => (
  <motion.div
    className="lps-import"
    initial="hidden"
    whileInView="show"
    viewport={{ root, once: true, amount: 0.5 }}
  >
    <motion.div
      className="lps-file"
      variants={{ hidden: { x: -70, y: -20, rotate: -14, opacity: 0 }, show: { x: 0, y: 0, rotate: -5, opacity: 1 } }}
      transition={{ type: "spring", stiffness: 130, damping: 14 }}
    >
      <FileText size={20} />
      <span>
        semester-a.ics
        <small>University calendar</small>
      </span>
    </motion.div>
    <motion.div
      className="lps-import-arrow"
      variants={{ hidden: { scaleX: 0, opacity: 0 }, show: { scaleX: 1, opacity: 1 } }}
      transition={{ delay: 0.35, duration: 0.5 }}
    />
    <motion.div
      className="lps-import-list"
      variants={{ hidden: {}, show: { transition: { delayChildren: 0.6, staggerChildren: 0.12 } } }}
    >
      {COURSES.map((c, i) => (
        <motion.div
          key={c.name}
          className="lps-import-course"
          variants={{ hidden: { opacity: 0, x: 18, scale: 0.95 }, show: { opacity: 1, x: 0, scale: 1 } }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        >
          <i style={{ background: c.color }} />
          <span>{c.name}</span>
          <em>{[4, 3, 3, 2][i]} deadlines</em>
        </motion.div>
      ))}
    </motion.div>
  </motion.div>
);

const TABS = ["Assignments", "Exams", "Course info"] as const;

const AssignmentsPanel = () => {
  const [done, setDone] = useState([true, false, false]);
  useEffect(() => {
    const t = setTimeout(() => setDone([true, true, false]), 1100);
    return () => clearTimeout(t);
  }, []);
  const rows = [
    ["Problem set 3", "Oct 20"],
    ["Problem set 4", "Oct 28"],
    ["Programming exercise 2", "Nov 4"],
  ];
  return (
    <div className="lps-asg">
      {rows.map(([name, due], i) => (
        <div key={name} className={`lps-asg-row${done[i] ? " done" : ""}`}>
          <motion.span
            className="lps-check"
            animate={done[i] ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            {done[i] && <Check size={11} strokeWidth={3.5} />}
          </motion.span>
          <span className="lps-asg-name">{name}</span>
          <span className="lps-asg-due">{due}</span>
          <span className={`lps-pill ${done[i] ? "ok" : "warn"}`}>{done[i] ? "Completed" : "Pending"}</span>
        </div>
      ))}
    </div>
  );
};

const ExamsPanel = () => {
  const exams = ["2025 A", "2025 B", "2024 B"];
  const scores = [
    [100, 85, 100, 60, 100],
    [100, 100, 70, 100, null],
    [80, null, null, null, null],
  ];
  return (
    <div className="lps-exams">
      <div className="lps-exams-row lps-exams-head">
        <span>Exam</span>
        {[1, 2, 3, 4, 5].map((q) => (
          <span key={q}>Q{q}</span>
        ))}
      </div>
      {exams.map((e, r) => (
        <div key={e} className="lps-exams-row">
          <span>{e}</span>
          {scores[r].map((s, q) => (
            <motion.span
              key={q}
              className={`lps-score${s === null ? " empty" : s >= 90 ? " ok" : s >= 70 ? " mid" : " low"}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * (r * 5 + q) }}
            >
              {s ?? "–"}
            </motion.span>
          ))}
        </div>
      ))}
    </div>
  );
};

const InfoPanel = () => (
  <div className="lps-info">
    <div className="lps-links">
      {[
        ["Moodle", "moodle.example.ac.il"],
        ["Drive", "drive.google.com"],
      ].map(([n, host]) => (
        <span key={n} className="lps-link">
          {n === "Drive" ? <FolderOpen size={14} /> : <Link2 size={14} />}
          <b>{n}</b>
          <em>{host}</em>
        </span>
      ))}
    </div>
    <div className="lps-notes">
      Final is 60% of the grade. Review graphs before the <span className="lps-mention">@Linear Algebra</span> quiz.
    </div>
  </div>
);

const CoursesShot: React.FC<{ root: Root }> = ({ root }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { root, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState(false);
  // Cycles the tabs while in view, until the visitor picks one.
  useEffect(() => {
    if (!inView || touched || reduceMotion) return;
    const t = setInterval(() => setTab((x) => (x + 1) % TABS.length), 3400);
    return () => clearInterval(t);
  }, [inView, touched, reduceMotion]);
  return (
    <div className="lps-courses" ref={ref}>
      <div className="lps-course-head">
        <i style={{ background: COURSES[0].color }} />
        <strong>Algorithms</strong>
        <span>3 of 5 done</span>
      </div>
      <div className="lps-seg" role="tablist">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === i}
            className={tab === i ? "on" : ""}
            onClick={() => {
              setTouched(true);
              setTab(i);
            }}
          >
            {tab === i && (
              <motion.span layoutId="lps-seg-thumb" className="lps-seg-thumb" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
            )}
            <span className="lps-seg-label">{t}</span>
          </button>
        ))}
      </div>
      <div className="lps-panel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.25 }}
          >
            {tab === 0 ? <AssignmentsPanel /> : tab === 1 ? <ExamsPanel /> : <InfoPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const BLOCKS = [
  { from: 0, len: 2, name: "Algorithms lecture", color: COURSES[0].color },
  { from: 2.5, len: 1.5, name: "Study: Physics", color: COURSES[1].color },
  { from: 4.5, len: 1, name: "Lab", color: COURSES[3].color },
];

const ScheduleShot: React.FC<{ root: Root }> = ({ root }) => (
  <div className="lps-sched">
    <div className="lps-sched-day">
      <div className="lps-sched-title">
        <strong>Thursday</strong>
        <span>Oct 30</span>
      </div>
      <div className="lps-sched-grid">
        {["08", "09", "10", "11", "12", "13", "14"].map((h) => (
          <span key={h} className="lps-hour">
            {h}:00
          </span>
        ))}
        {BLOCKS.map((b, i) => (
          <motion.div
            key={b.name}
            className="lps-block"
            style={{ top: `${(b.from / 6.5) * 100}%`, height: `${(b.len / 6.5) * 100}%`, borderColor: b.color, background: `${b.color}22` }}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ root, once: true }}
            transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 300, damping: 26 }}
          >
            {b.name}
          </motion.div>
        ))}
        <div className="lps-now" style={{ top: "54%" }}>
          <i />
        </div>
      </div>
    </div>
    <motion.div
      className="lps-push"
      initial={{ y: -36, opacity: 0, scale: 0.94 }}
      whileInView={{ y: 0, opacity: 1, scale: 1 }}
      viewport={{ root, once: true }}
      transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 20 }}
    >
      <span className="lps-push-icon">
        <Bell size={14} />
      </span>
      <span>
        <b>OPlanner</b>
        Lab report 3 is due tomorrow at 23:59
      </span>
    </motion.div>
  </div>
);

// ---------------------------------------------------------------- page

const EVERYWHERE = [
  { icon: Layers, title: "Years and semesters", text: "Every year in its own tab, every semester with its own color." },
  { icon: MonitorSmartphone, title: "Install anywhere", text: "Add it to your phone or desktop like a native app." },
  { icon: CloudOff, title: "Works offline", text: "Edit without a connection; it syncs when you're back." },
  { icon: MoonStar, title: "Light and dark", text: "Easy on the eyes at 2am before a deadline." },
  { icon: PartyPopper, title: "A little celebration", text: "Confetti when you finish a task. You earned it." },
  { icon: ShieldCheck, title: "Private by default", text: "Your planner is yours alone. Delete it any time." },
];

const SAFETY = [
  { icon: Check, title: "You approve every change", text: "It suggests a card; nothing is saved until you tap Add." },
  { icon: Undo2, title: "Undo is one tap away", text: "Dismissed something by mistake? Bring it back." },
  { icon: ShieldCheck, title: "Only your planner", text: "It reads your own courses and tasks, nothing else." },
];

const LandingSections: React.FC<{ root: Root; cta: React.ReactNode }> = ({ root, cta }) => {
  const reduceMotion = useReducedMotion();
  const init = reduceMotion ? "show" : "hidden";
  const viewport = { root, once: true, amount: 0.3 };

  return (
    <div className="lps">
      <Row
        root={root}
        id="overview"
        kicker="Overview"
        title={
          <>
            Your whole semester.
            <br />
            One page.
          </>
        }
        text="Progress, what's pending and what's overdue, what's up next this week, the month on a calendar and the countdown to every final."
      >
        <OverviewShot root={root} />
      </Row>

      <Row
        root={root}
        id="import"
        flip
        kicker="Import"
        title={
          <>
            From your calendar
            <br />
            to a plan in seconds.
          </>
        }
        text="Drop in the .ics file from your university. Courses are created, colored and filled with their deadlines."
        points={["Courses created for you", "Every deadline in place", "No typing it all in"]}
      >
        <ImportShot root={root} />
      </Row>

      <Row
        root={root}
        id="courses"
        kicker="Courses"
        title={
          <>
            Everything about a course,
            <br />
            in three tabs.
          </>
        }
        text="Assignments with due dates and status. An exam tracker for every past paper, question by question. Course info with your links and notes."
        points={["Notes that @-mention other courses", "Practice exams scored per question", "Moodle, Drive and any link in one place"]}
      >
        <CoursesShot root={root} />
      </Row>

      <Row
        root={root}
        id="schedule"
        flip
        kicker="Schedule"
        title={
          <>
            Your day, planned.
            <br />
            Your deadlines, never missed.
          </>
        }
        text="Block out lectures and study time on the day view, and get a push reminder before anything is due, even with the app closed."
      >
        <ScheduleShot root={root} />
      </Row>

      <section className="lps-section">
        <motion.div className="lps-center" variants={textIn} initial={init} whileInView="show" viewport={viewport}>
          <span className="lps-kicker">The Assistant</span>
          <h2>Helpful, and never in charge.</h2>
        </motion.div>
        <motion.div className="lps-cards lps-cards-3" variants={stagger} initial={init} whileInView="show" viewport={viewport}>
          {SAFETY.map((s) => (
            <motion.div key={s.title} className="lps-card" variants={textIn}>
              <span className="lps-card-icon lps-card-icon-grad">
                <s.icon size={18} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="lps-section">
        <motion.div className="lps-center" variants={textIn} initial={init} whileInView="show" viewport={viewport}>
          <span className="lps-kicker">And the details</span>
          <h2>Made for every device and every hour.</h2>
        </motion.div>
        <motion.div className="lps-cards" variants={stagger} initial={init} whileInView="show" viewport={viewport}>
          {EVERYWHERE.map((s) => (
            <motion.div key={s.title} className="lps-card" variants={textIn}>
              <span className="lps-card-icon">
                <s.icon size={18} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <motion.section className="lps-section lps-cta" variants={textIn} initial={init} whileInView="show" viewport={viewport}>
        <h2>
          Your semester, <span className="lp-accent">sorted.</span>
        </h2>
        <p>Free for students. Your first year is set up the moment you sign in.</p>
        {cta}
      </motion.section>
    </div>
  );
};

export default LandingSections;
