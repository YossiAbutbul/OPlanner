import React from "react";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";
import type { PlanCourse } from "../../types/models";

interface Props {
  stats: PlanStats;
  courses: PlanCourse[];
}

const SEMESTERS = ["Semester A", "Semester B"];

const nextTerm = (term: { year: number; semester: string }) => {
  const i = SEMESTERS.indexOf(term.semester);
  return i === 0
    ? { year: term.year, semester: SEMESTERS[1] }
    : { year: term.year + 1, semester: SEMESTERS[0] };
};

const shortTerm = (term: { year: number; semester: string }) =>
  `${term.semester.replace("Semester ", "Sem ")} ${String(term.year).slice(2)}`;

// The remaining semesters laid out as steps, with planned credits per term
// where the user has already scheduled courses.
const TimelinePanel: React.FC<Props> = ({ stats, courses }) => {
  const { currentTerm, semestersRemaining } = stats;

  const plannedByTerm = new Map<string, number>();
  courses
    .filter((c) => c.status === "PLANNED" && c.year && c.semester)
    .forEach((c) => {
      const key = `${c.year}|${c.semester}`;
      plannedByTerm.set(key, (plannedByTerm.get(key) ?? 0) + (c.credits || 0));
    });

  const steps: { term: { year: number; semester: string }; credits: number; now: boolean }[] = [];
  if (currentTerm && semestersRemaining > 0) {
    let cursor = { ...currentTerm };
    for (let i = 0; i < Math.min(semestersRemaining, 6); i++) {
      const key = `${cursor.year}|${cursor.semester}`;
      const planned = plannedByTerm.get(key) ?? 0;
      const active = i === 0 ? stats.creditsActive : 0;
      steps.push({ term: { ...cursor }, credits: planned + active, now: i === 0 });
      cursor = nextTerm(cursor);
    }
  }

  const donePct = Math.min(100, stats.progressPct);
  const activePct = Math.min(100 - donePct, stats.activePct);

  return (
    <section className="sp-panel sp-panel-wide">
      <div className="sp-panel-head">
        <h3>Timeline</h3>
        <span className="sp-hint">
          {stats.creditsPerSemesterNeeded > 0
            ? `${stats.creditsPerSemesterNeeded.toFixed(1)} credits per semester to finish`
            : "degree complete"}
        </span>
      </div>

      <div className="sp-rail" aria-hidden="true">
        <i className="sp-rail-done" style={{ width: `${donePct}%` }} />
        <i className="sp-rail-active" style={{ width: `${activePct}%` }} />
      </div>

      {steps.length === 0 ? (
        <p className="sp-empty-line">
          Give courses a year and semester and the remaining terms show up here,
          with the credits already scheduled in each.
        </p>
      ) : (
        <div className="sp-tl">
          {steps.map((s) => (
            <div
              className={`sp-tl-step ${s.now ? "sp-tl-now" : ""}`}
              key={`${s.term.year}-${s.term.semester}`}
            >
              <span className="sp-tl-term">{shortTerm(s.term)}</span>
              <span className="sp-tl-cr">
                {s.credits > 0 ? `${formatCredits(s.credits)} cr` : "nothing planned"}
              </span>
            </div>
          ))}
          {stats.graduationTerm && (
            <div className="sp-tl-step sp-tl-grad">
              <span className="sp-tl-term">Graduate</span>
              <span className="sp-tl-cr">{stats.graduationTerm}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default TimelinePanel;
