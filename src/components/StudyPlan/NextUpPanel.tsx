import React, { useMemo } from "react";
import { CalendarPlus } from "lucide-react";
import CustomSelect from "../CustomSelect";
import type { PlanCourse } from "../../types/models";
import type { PlanStats } from "../../hooks/usePlanStats";
import { formatCredits } from "../../utility/planFormat";

interface Props {
  courses: PlanCourse[];
  stats: PlanStats;
  onSchedule: (course: PlanCourse, year: number, semester: string) => Promise<void>;
  onAddCourse: () => void;
}

const SEMESTERS = ["Semester A", "Semester B"];

// The next few terms, starting from the one in progress.
const upcomingTerms = (
  current: { year: number; semester: string } | null,
  count: number
): { year: number; semester: string }[] => {
  const now = new Date();
  const start =
    current ?? { year: now.getFullYear(), semester: now.getMonth() >= 6 ? "Semester A" : "Semester B" };
  const terms: { year: number; semester: string }[] = [];
  let { year } = start;
  let index = Math.max(0, SEMESTERS.indexOf(start.semester));
  for (let i = 0; i < count; i++) {
    index += 1;
    if (index > 1) {
      index = 0;
      year += 1;
    }
    terms.push({ year, semester: SEMESTERS[index] });
  }
  return terms;
};

// Courses that are planned but have no term yet. Each one can be dropped into
// an upcoming semester in a single click.
const NextUpPanel: React.FC<Props> = ({ courses, stats, onSchedule, onAddCourse }) => {
  const unscheduled = useMemo(
    () => courses.filter((c) => c.status === "PLANNED" && (!c.year || !c.semester)),
    [courses]
  );

  const terms = useMemo(() => upcomingTerms(stats.currentTerm, 5), [stats.currentTerm]);
  const options = terms.map((t) => ({
    value: `${t.year}|${t.semester}`,
    label: `${t.semester.replace("Semester ", "Sem ")} ${String(t.year).slice(2)}`,
  }));

  if (unscheduled.length === 0) return null;

  return (
    <section className="sp-block">
      <header className="sp-block-head">
        <h2>What to take next</h2>
        <button type="button" className="sp-link-btn" onClick={onAddCourse}>
          <CalendarPlus size={15} />
          Add a course
        </button>
      </header>

      <p className="sp-block-note">
        {unscheduled.length} planned course{unscheduled.length === 1 ? "" : "s"} without a
        semester. Pick a term and it joins the forecast.
      </p>

      <ul className="sp-next">
        {unscheduled.map((c) => (
          <li className="sp-next-row" key={c.id}>
            <span className="sp-next-name" title={c.name}>
              {c.name}
            </span>
            <span className="sp-next-cr">{formatCredits(c.credits)} cr</span>
            <span className="sp-next-pick">
              <CustomSelect
                value=""
                placeholder="Take in…"
                options={options}
                onChange={(v) => {
                  const [year, semester] = v.split("|");
                  void onSchedule(c, Number(year), semester);
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default NextUpPanel;
