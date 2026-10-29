import React, { useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps, PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseInfo } from "../../types/models";
import type { CourseStats } from "../../hooks/useSemesterStats";
import { useSemesterGrades } from "../../hooks/useSemesterGrades";
import { courseColor } from "../../utility/courseColor";
import { capitalizeWords } from "../../utility/dayCalendar";
import { lsCache } from "../../hooks/useLocalStorageCache";
import RollingNumber from "../RollingNumber";
import SemesterGrades from "./SemesterGrades";
import { ringDash } from "../../utility/ring";

interface Props {
  year: number;
  semester: string;
  byCourse: CourseStats[];
  courses: CourseInfo[];
  onSelectCourse: (course: string) => void;
}

// The slot holds two views of the same courses: task progress and grades.
// It pages like a carousel: swipe or drag the card, two-finger swipe on a
// trackpad, or the arrows. It wraps around at either end, and the
// choice is remembered per browser.
const VIEWS = [
  { key: "courses", title: "Courses" },
  { key: "grades", title: "Grades" },
] as const;
type View = (typeof VIEWS)[number]["key"];
const VIEW_KEY = "oplanner.overview.courseView";

// A full-width track: the old card leaves by its whole width while the new
// one comes in right behind it. The right arrow (or a swipe left) brings the
// next card in from the right; the left arrow (or a swipe right) brings it
// in from the left.
const AHEAD = "calc(100% + 16px)";
const BEHIND = "calc(-100% - 16px)";
const listVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? AHEAD : BEHIND, opacity: 0.6 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? BEHIND : AHEAD, opacity: 0.6 }),
};
const fadeVariants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };
const spring = { type: "spring", bounce: 0, visualDuration: 0.42 } as const;

// A drag pages over once it has gone this far, or was flicked this fast.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;
// Trackpad swipes arrive as a burst of wheel events; one burst is one page.
const WHEEL_THRESHOLD = 40;
const WHEEL_COOLDOWN_MS = 450;

// One card on the track. It enters from the side its click asked for and,
// once it starts leaving, keeps the direction of the click that sent it off:
// later clicks during a burst never turn a card that is already on its way
// out, so every switch plays the same however fast they come.
const Page: React.FC<
  HTMLMotionProps<"div"> & { side: number; latestDir: React.RefObject<number>; reduce: boolean }
> = ({ side, latestDir, reduce, ...rest }) => {
  const isPresent = useIsPresent();
  const exitDir = useRef<number | null>(null);
  // Read once, on the first render after removal; a ref keeps it fixed.
  // eslint-disable-next-line react-hooks/refs
  if (!isPresent && exitDir.current === null) exitDir.current = latestDir.current;
  // eslint-disable-next-line react-hooks/refs
  const custom = isPresent ? side : exitDir.current ?? side;
  return (
    <motion.div
      {...rest}
      custom={custom}
      variants={reduce ? fadeVariants : listVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={reduce ? { duration: 0.15 } : spring}
    />
  );
};

// Checkmark that draws itself in once the ring has closed, and fades back
// out if the course drops below 100%.
const RingCheck: React.FC = () => {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      className="course-ring-check"
      viewBox="0 0 24 24"
      width={14}
      height={14}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", bounce: 0, visualDuration: 0.3, delay: reduce ? 0 : 0.45 }}
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.55 }}
      />
    </motion.svg>
  );
};

// Activity-style ring in the course colour. pathLength=100 lets the dash
// array read as a plain percentage; CSS transitions it when the value moves.
export const CourseRing: React.FC<{ pct: number; done: boolean }> = ({ pct, done }) => (
  <span className="course-ring" aria-hidden="true">
    <svg className="course-ring-svg" viewBox="0 0 36 36">
      <circle className="course-ring-track" cx="18" cy="18" r="15" />
      <circle
        className="course-ring-fill"
        cx="18"
        cy="18"
        r="15"
        pathLength={100}
        style={{ strokeDasharray: ringDash(pct, 4, 15) }}
      />
    </svg>
    <AnimatePresence initial={true}>{done && <RingCheck key="check" />}</AnimatePresence>
  </span>
);

const CourseList: React.FC<Omit<Props, "year" | "semester">> = ({ byCourse, courses, onSelectCourse }) => (
  <ul className="course-stats">
    {byCourse.map((s) => {
      const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      const courseInfo = courses.find((c) => c.name === s.course);
      const color = courseColor(s.course, courseInfo?.color);
      const done = s.total > 0 && s.completed === s.total;
      return (
        <li
          key={s.course}
          className={`course-stat${done ? " is-done" : ""}`}
          style={{ "--course-color": color } as React.CSSProperties}
          onClick={() => onSelectCourse(s.course)}
        >
          <CourseRing pct={pct} done={done} />
          <span className="course-stat-text">
            <span className="course-stat-name">{capitalizeWords(s.course)}</span>
            <span className="course-stat-meta">
              {s.total === 0
                ? "No tasks yet"
                : done
                  ? `All ${s.total} done`
                  : `${s.completed} of ${s.total} done`}
              {s.overdue > 0 && (
                <span className="course-stat-overdue"> · {s.overdue} overdue</span>
              )}
            </span>
          </span>
          <span className="course-stat-pct">
            <RollingNumber value={pct} suffix="%" />
          </span>
        </li>
      );
    })}
  </ul>
);

const CoursesPanel: React.FC<Props> = ({ year, semester, byCourse, courses, onSelectCourse }) => {
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>(() =>
    lsCache.read<View>(VIEW_KEY) === "grades" ? "grades" : "courses"
  );
  // Which side the next card comes in from: 1 the right, -1 the left. The
  // ref carries the same value to cards already leaving, and `turn` gives
  // every switch a fresh card, so going back mid-slide doesn't drag the
  // half-gone card back from wherever it had got to.
  const [dir, setDir] = useState(1);
  const [turn, setTurn] = useState(0);
  const latestDir = useRef(1);
  const { byCourse: grades } = useSemesterGrades(year, semester, courses);

  const index = VIEWS.findIndex((v) => v.key === view);
  const at = (step: number) => VIEWS[(index + step + VIEWS.length) % VIEWS.length];
  const go = (step: number) => {
    const next = at(step);
    latestDir.current = step;
    setDir(step);
    setTurn((t) => t + 1);
    setView(next.key);
    lsCache.write(VIEW_KEY, next.key);
  };

  // A drag that ends on a row must not also open that course.
  const dragged = useRef(false);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) go(1);
    else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) go(-1);
  };

  const wheel = useRef({ sum: 0, lockedUntil: 0 });
  const onWheel = (e: React.WheelEvent) => {
    // Only a clearly sideways gesture; vertical scrolling passes through.
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const w = wheel.current;
    const now = performance.now();
    if (now < w.lockedUntil) return;
    w.sum += e.deltaX;
    if (Math.abs(w.sum) < WHEEL_THRESHOLD) return;
    go(w.sum > 0 ? 1 : -1);
    w.sum = 0;
    w.lockedUntil = now + WHEEL_COOLDOWN_MS;
  };

  return (
    <section className="overview-section">
      <div className="ovc-head">
        <span className="ovc-title">
          {/* A plain crossfade: both titles share one grid cell, so the
              swap never shifts the header or clips a letter. */}
          <AnimatePresence initial={false}>
            <motion.h2
              key={view}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {VIEWS[index].title}
            </motion.h2>
          </AnimatePresence>
        </span>
        <div className="ovc-switch" role="group" aria-label="Switch list">
          <button
            type="button"
            className="ovc-switch-btn"
            onClick={() => go(-1)}
            aria-label={`Show ${at(-1).title}`}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="ovc-switch-btn"
            onClick={() => go(1)}
            aria-label={`Show ${at(1).title}`}
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="ovc-body" onWheel={onWheel}>
        <AnimatePresence mode="popLayout" initial={false}>
          <Page
            key={`${view}-${turn}`}
            className="ovc-page"
            side={dir}
            latestDir={latestDir}
            reduce={!!reduce}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            dragMomentum={false}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={onDragEnd}
            onClickCapture={(e) => {
              if (!dragged.current) return;
              dragged.current = false;
              e.stopPropagation();
            }}
            onPointerDown={() => { dragged.current = false; }}
          >
            {view === "courses" ? (
              <CourseList byCourse={byCourse} courses={courses} onSelectCourse={onSelectCourse} />
            ) : (
              <SemesterGrades byCourse={grades} courses={courses} onSelectCourse={onSelectCourse} />
            )}
          </Page>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default CoursesPanel;
