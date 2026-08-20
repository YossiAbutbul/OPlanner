import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTimeBlocks } from "../../context/TimeBlockContext";
import { courseColor } from "../../utility/courseColor";
import { fmtDate, hexToRgba, toIso } from "../../utility/dayCalendar";
import {
  buildWeeklyReport,
  fmtMinutes,
  fmtSpan,
  PERSONAL_BUCKET,
  shiftWeeks,
  weekLabel,
  weeklyTrend,
  weekStartOf,
} from "../../utility/weeklyReport";
import type { CourseInfo, HomeworkEntry } from "../../types/models";
import "../../css/WeeklyReport.css";

interface Props {
  semester: string;
  courses: CourseInfo[];
  /** Every task in the semester, including the synthetic "reminders" course. */
  tasks: HomeworkEntry[];
}

const PERSONAL_COLOR = "#b9bcc2";
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const dayName = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long" });

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short" });

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

const WeeklyReport: React.FC<Props> = ({ courses, tasks }) => {
  const { blocks } = useTimeBlocks();
  const [weekStart, setWeekStart] = useState(() => toIso(weekStartOf(new Date())));

  const report = useMemo(
    () => buildWeeklyReport({ tasks, blocks, courses, weekStart }),
    [tasks, blocks, courses, weekStart]
  );
  const trend = useMemo(() => weeklyTrend(tasks, blocks, weekStart, 6), [tasks, blocks, weekStart]);

  const colorOf = (name: string) => {
    if (name === PERSONAL_BUCKET) return PERSONAL_COLOR;
    const c = courses.find((co) => co.name === name);
    return courseColor(name, c?.color);
  };

  const today = toIso(new Date());
  const peak = Math.max(...report.byDay.map((d) => d.minutes), 60);
  const trendPeak = Math.max(...trend.map((w) => w.minutes), 60);
  const avgMinutes = report.minutes / 7;

  const judged = report.onTime + report.late + report.unfinished;
  const seg = (n: number) => (judged > 0 ? (n / judged) * 100 : 0);
  const onTimeSeg = seg(report.onTime);
  const lateSeg = seg(report.late);
  const openSeg = seg(report.unfinished);

  return (
    <section className="wr">
      <header className="wr-header">
        <h2>Weekly report</h2>
        <span className="wr-range">
          {weekLabel(report.weekStart)}
          {report.isCurrent && <span className="wr-live"> · this week</span>}
        </span>
        <div className="wr-nav">
          <div className="wr-weeknav">
            <button type="button" onClick={() => setWeekStart((w) => shiftWeeks(w, -1))} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((w) => shiftWeeks(w, 1))}
              disabled={report.isCurrent}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            type="button"
            className="wr-btn"
            onClick={() => setWeekStart(toIso(weekStartOf(new Date())))}
            disabled={report.isCurrent}
          >
            This week
          </button>
        </div>
      </header>

      <div className="wr-bento">
        {/* ---- hero: the week in one tile ---- */}
        <article className="wr-tile wr-hero">
          <div className="wr-hero-top">
            <span className="wr-label wr-label-dark">This week</span>
            <span className={`wr-chip ${report.delta.completed >= 0 ? "is-up" : "is-down"}`}>
              {signed(report.delta.completed)} vs last
            </span>
          </div>

          <div className="wr-hero-figure">
            <span className="wr-hero-num">{report.completed}</span>
            <span className="wr-hero-unit">tasks<br />done</span>
          </div>

          <div className="wr-hero-progress">
            <div className="wr-hero-bar">
              <span style={{ width: `${report.completionPct}%` }} />
            </div>
            <span className="wr-hero-progress-text">
              {report.dueDone}/{report.due} due · {report.completionPct}%
            </span>
          </div>

          <div className="wr-hero-stats">
            <div>
              <span className="wr-hero-stat-val">{fmtMinutes(report.minutes)}</span>
              <span className="wr-hero-stat-label">time</span>
            </div>
            <div>
              <span className="wr-hero-stat-val">{fmtMinutes(avgMinutes)}</span>
              <span className="wr-hero-stat-label">per day</span>
            </div>
            <div>
              <span className={`wr-hero-stat-val ${report.overdue.length > 0 ? "is-bad" : ""}`}>
                {report.overdue.length}
              </span>
              <span className="wr-hero-stat-label">overdue</span>
            </div>
          </div>
        </article>

        {/* ---- rhythm ---- */}
        <article className="wr-tile wr-t-rhythm">
          <div className="wr-tile-head">
            <span className="wr-label">Rhythm</span>
            <span className="wr-note">
              {report.bestDay ? `best ${shortDay(report.bestDay.iso)} · ${fmtMinutes(report.bestDay.minutes)}` : "no time blocked"}
            </span>
          </div>
          <div className="wr-chart">
            {avgMinutes > 0 && (
              <div className="wr-avg" style={{ bottom: `${Math.min(96, (avgMinutes / peak) * 100)}%` }}>
                <span>avg {fmtMinutes(avgMinutes)}</span>
              </div>
            )}
            {report.byDay.map((d, i) => (
              <div
                key={d.iso}
                className={`wr-day${report.bestDay?.iso === d.iso ? " is-best" : ""}${d.iso === today ? " is-today" : ""}`}
                title={`${dayName(d.iso)}: ${fmtMinutes(d.minutes)}, ${d.completed} done`}
              >
                <span className="wr-day-val">{d.minutes > 0 ? fmtMinutes(d.minutes) : ""}</span>
                <span className="wr-day-bar" style={{ height: `${Math.round((d.minutes / peak) * 100)}%` }} />
                <span className="wr-day-foot">
                  <span className="wr-day-label">{DAY_INITIALS[i]}</span>
                  <span className={`wr-day-count${d.completed > 0 ? " is-on" : ""}`}>{d.completed}</span>
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* ---- six week trend ---- */}
        <article className="wr-tile wr-t-trend">
          <div className="wr-tile-head">
            <span className="wr-label">6 weeks</span>
            <span className="wr-note">hours per week</span>
          </div>
          <div className="wr-trend">
            {trend.map((w) => (
              <div
                key={w.weekStart}
                className={`wr-trend-col${w.weekStart === report.weekStart ? " is-current" : ""}`}
                title={`${weekLabel(w.weekStart)}: ${fmtMinutes(w.minutes)}, ${w.completed} closed`}
              >
                <span
                  className="wr-trend-bar"
                  style={{ height: `${Math.max(4, Math.round((w.minutes / trendPeak) * 100))}%` }}
                />
                <span className="wr-trend-tick">{w.completed}</span>
              </div>
            ))}
          </div>
        </article>

        {/* ---- courses ---- */}
        <article className="wr-tile wr-t-courses">
          <div className="wr-tile-head">
            <span className="wr-label">Courses</span>
            <span className="wr-note">{report.byCourse.length} active</span>
          </div>
          {report.byCourse.length === 0 ? (
            <p className="wr-empty">Nothing logged this week</p>
          ) : (
            <ul className="wr-courses">
              {report.byCourse.map((c) => {
                const color = colorOf(c.course);
                return (
                  <li
                    key={c.course}
                    style={{ borderLeftColor: color }}
                    title={`${c.course}: ${fmtMinutes(c.minutes)} (${c.pct}%), ${c.done} of ${c.due} tasks done`}
                  >
                    <span
                      className="wr-course-fill"
                      style={{ width: `${Math.max(2, c.pct)}%`, background: hexToRgba(color, 0.18) }}
                    />
                    <span className="wr-course-name" dir="auto">{c.course}</span>
                    <span className="wr-course-val">{c.minutes > 0 ? fmtMinutes(c.minutes) : "0m"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        {/* ---- punctuality ---- */}
        <article className="wr-tile wr-t-ontime">
          <div className="wr-tile-head">
            <span className="wr-label">On time</span>
            {report.onTimeReliable && report.late > 0 && (
              <span className="wr-note">avg {fmtSpan(report.avgLateMinutes)} late</span>
            )}
          </div>
          <div className="wr-punct">
            <div className="wr-donut">
              <svg viewBox="0 0 42 42" role="img" aria-label={`${report.onTime} on time, ${report.late} late, ${report.unfinished} open`}>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f2f4" strokeWidth="8" />
                {report.onTimeReliable && onTimeSeg > 0 && (
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-accent)" strokeWidth="8"
                    strokeLinecap="round" strokeDasharray={`${onTimeSeg} ${100 - onTimeSeg}`} strokeDashoffset="25" />
                )}
                {report.onTimeReliable && lateSeg > 0 && (
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f0a742" strokeWidth="8"
                    strokeLinecap="round" strokeDasharray={`${lateSeg} ${100 - lateSeg}`} strokeDashoffset={`${25 - onTimeSeg}`} />
                )}
                {report.onTimeReliable && openSeg > 0 && (
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#d23030" strokeWidth="8"
                    strokeLinecap="round" strokeDasharray={`${openSeg} ${100 - openSeg}`} strokeDashoffset={`${25 - onTimeSeg - lateSeg}`} />
                )}
              </svg>
              <span className={`wr-donut-val${report.onTimeReliable ? "" : " is-na"}`}>
                {report.onTimeReliable ? `${report.onTimePct}%` : "n/a"}
              </span>
            </div>
            <ul className="wr-keys">
              <li><i style={{ background: "var(--color-accent)" }} /><b>{report.onTime}</b> on time</li>
              <li><i style={{ background: "#f0a742" }} /><b>{report.late}</b> late</li>
              <li><i style={{ background: "#d23030" }} /><b>{report.unfinished}</b> open</li>
              {report.unstamped > 0 && (
                <li className="is-soft"><i style={{ background: "#e6e7ea" }} /><b>{report.unstamped}</b> untracked</li>
              )}
            </ul>
          </div>
        </article>

        {/* ---- deadlines, as a timeline ---- */}
        <article className="wr-tile wr-t-deadlines">
          <div className="wr-tile-head">
            <span className="wr-label">Deadlines</span>
            <span className="wr-note">{report.overdue.length} overdue · {report.upcoming.length} in 7 days</span>
          </div>
          {report.overdue.length === 0 && report.upcoming.length === 0 && report.exams.length === 0 ? (
            <p className="wr-empty">Nothing due, nothing overdue</p>
          ) : (
            <ol className="wr-timeline">
              {report.overdue.map(({ task, daysOver }) => (
                <li key={`o-${task.id}`} className="is-over">
                  <span className="wr-tl-when">{daysOver === 0 ? "today" : `${daysOver}d over`}</span>
                  <span className="wr-tl-rail"><i style={{ background: colorOf(task.course) }} /></span>
                  <span className="wr-tl-body">
                    <span className="wr-tl-name" dir="auto">{task.name}</span>
                    <span className="wr-tl-meta" dir="auto">{task.course} · {fmtDate(task.dueDate)}</span>
                  </span>
                </li>
              ))}
              {report.upcoming.map((task) => {
                const left = daysBetween(today, task.dueDate);
                return (
                  <li key={`u-${task.id}`} className={left <= 1 ? "is-soon" : ""}>
                    <span className="wr-tl-when">
                      {left === 0 ? "today" : left === 1 ? "tomorrow" : shortDay(task.dueDate)}
                    </span>
                    <span className="wr-tl-rail"><i style={{ background: colorOf(task.course) }} /></span>
                    <span className="wr-tl-body">
                      <span className="wr-tl-name" dir="auto">{task.name}</span>
                      <span className="wr-tl-meta" dir="auto">{task.course} · {fmtDate(task.dueDate)}</span>
                    </span>
                  </li>
                );
              })}
              {report.exams.slice(0, 2).map((e) => (
                <li key={`e-${e.course}`} className="is-exam">
                  <span className="wr-tl-when">{e.daysLeft}d</span>
                  <span className="wr-tl-rail"><i style={{ background: colorOf(e.course) }} /></span>
                  <span className="wr-tl-body">
                    <span className="wr-tl-name" dir="auto">{e.course}</span>
                    <span className="wr-tl-meta">final exam · {fmtDate(e.date)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
};

export default WeeklyReport;
