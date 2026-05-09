import React, { useEffect, useMemo, useState } from "react";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import HomeworkModal from "./HomeworkModal";
import { YearTreeData } from "../App";
import "../css/RightSidebar.css";

interface RightSidebarProps {
  years: YearTreeData[];
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const capitalizeWords = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const dayName = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const daysLeft = (iso: string) => {
  const due = startOfDay(new Date(iso));
  const now = startOfDay(new Date());
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const urgencyClass = (d: number) => {
  if (d <= 5) return "danger";
  if (d <= 10) return "warn";
  return "ok";
};

const RightSidebar: React.FC<RightSidebarProps> = ({
  years,
  selectedYear,
  selectedSemester,
  selectedCourse,
}) => {
  void selectedCourse;
  const { getCourseTasks, addHomework, homework } = useHomework();
  const [items, setItems] = useState<HomeworkEntry[]>([]);
  const [editTask, setEditTask] = useState<HomeworkEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sources = useMemo(() => {
    const out: { year: number; semester: string; course: string }[] = [];
    if (selectedYear !== null && selectedSemester) {
      const y = years.find((yy) => yy.year === selectedYear);
      const s = y?.semesters.find((ss) => ss.name === selectedSemester);
      s?.courses.forEach((c) =>
        out.push({ year: selectedYear, semester: selectedSemester, course: c.name })
      );
    }
    return out;
  }, [years, selectedYear, selectedSemester]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lists = await Promise.all(
        sources.map((s) => getCourseTasks(s.year, s.semester, s.course))
      );
      if (cancelled) return;
      const all = lists.flat();
      const now = startOfDay(new Date());
      const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const filtered = all
        .filter((t) => t.status === "PENDING")
        .filter((t) => {
          const d = startOfDay(new Date(t.dueDate));
          return d >= now && d <= horizon;
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setItems(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [sources, getCourseTasks, homework]);

  const handleClick = (t: HomeworkEntry) => {
    setEditTask(t);
    setModalOpen(true);
  };

  return (
    <aside className="rs">
      <div className="rs-glow" aria-hidden />
      <header className="rs-head">
        <div className="rs-eyebrow">Next 14 days</div>
        <h2 className="rs-title">
          Up<span className="rs-title-italic">coming</span>
        </h2>
        <div className="rs-scope-row">
          <span className="rs-scope-label">this semester</span>
          <span className="rs-count">
            {items.length} {items.length === 1 ? "task" : "tasks"}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rs-empty">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 8h24" />
            <path d="M20 56h24" />
            <path d="M22 8c0 14 20 14 20 24s-20 10-20 24" />
            <path d="M42 8c0 14-20 14-20 24s20 10 20 24" />
            <path d="M26 18c2 4 6 6 6 10" opacity=".5" />
          </svg>
          <p className="rs-empty-text">
            <em>Nothing</em> on the horizon.
          </p>
        </div>
      ) : (
        <ol className="rs-rail">
          {items.map((t, i) => {
            const d = daysLeft(t.dueDate);
            const cls = urgencyClass(d);
            const labelTop = d === 0 ? "today" : `${d}`;
            const labelBot = d === 0 ? "" : d === 1 ? "day" : "days";
            return (
              <li
                key={`${t.course}-${t.id}`}
                className={`rs-row rs-${cls}`}
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => handleClick(t)}
              >
                <div className={`rs-pip rs-pip-${cls}`}>
                  <span className="rs-pip-num">{labelTop}</span>
                  {labelBot && <span className="rs-pip-unit">{labelBot}</span>}
                </div>
                <div className="rs-card">
                  <div className="rs-name">{t.name}</div>
                  <div className="rs-course">{capitalizeWords(t.course)}</div>
                  <div className="rs-date">
                    {dayName(t.dueDate)} {fmtDate(t.dueDate)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <HomeworkModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTask(null);
        }}
        onSave={async (id, name, dueDate, status, year, semester, course, ignoreOverdue) => {
          await addHomework(id, name, dueDate, status, year, semester, course, ignoreOverdue);
          setModalOpen(false);
          setEditTask(null);
        }}
        editHomework={editTask}
        selectedCourseData={null}
        isLoading={false}
      />
    </aside>
  );
};

export default RightSidebar;
