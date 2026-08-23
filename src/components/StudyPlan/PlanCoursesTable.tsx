import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Search, Trash2 } from "lucide-react";
import type { PlanConfig, PlanCourse, PlanCourseStatus } from "../../types/models";
import { STATUS_LABEL } from "../../services/plan";
import { effectiveGrade } from "../../hooks/usePlanStats";
import { courseColor } from "../../utility/courseColor";
import { formatCredits, formatGrade, formatMoney, termLabel } from "../../utility/planFormat";

interface Props {
  courses: PlanCourse[];
  config: PlanConfig;
  onEdit: (course: PlanCourse) => void;
  onDelete: (course: PlanCourse) => void;
}

type Filter = "ALL" | PlanCourseStatus;
type SortKey = "term" | "name" | "credits" | "grade" | "status";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PLANNED", label: "Planned" },
  { value: "FAILED", label: "Failed" },
];

const STATUS_CLASS: Record<PlanCourseStatus, string> = {
  COMPLETED: "sp-pill-done",
  IN_PROGRESS: "sp-pill-now",
  PLANNED: "sp-pill-plan",
  EXEMPT: "sp-pill-exempt",
  FAILED: "sp-pill-fail",
  DROPPED: "sp-pill-plan",
};

const termSortValue = (c: PlanCourse) =>
  (c.year ?? 0) * 10 + (c.semester ? "ABC".indexOf(c.semester.slice(-1)) + 1 : 0);

const PlanCoursesTable: React.FC<Props> = ({ courses, config, onEdit, onDelete }) => {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("term");
  const [asc, setAsc] = useState(false);

  const groupLabel = useMemo(() => {
    const map = new Map(config.groups.map((g) => [g.id, g.label]));
    return (id?: string) => (id ? map.get(id) ?? "—" : "—");
  }, [config.groups]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { ALL: courses.length };
    courses.forEach((c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
    });
    return acc;
  }, [courses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = courses.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.semester ?? "").toLowerCase().includes(q)
      );
    });

    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "credits":
          return ((a.credits || 0) - (b.credits || 0)) * dir;
        case "grade":
          return ((effectiveGrade(a) ?? -1) - (effectiveGrade(b) ?? -1)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        default:
          return (termSortValue(a) - termSortValue(b)) * dir || a.name.localeCompare(b.name);
      }
    });
  }, [courses, filter, query, sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "name");
    }
  };

  const sortIcon = (key: SortKey) =>
    key === sortKey ? (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null;

  return (
    <section className="sp-table-card">
      <div className="sp-table-top">
        <h3>Courses</h3>
        <div className="sp-filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`sp-fchip ${filter === f.value ? "sp-fchip-on" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} {counts[f.value] ?? 0}
            </button>
          ))}
        </div>
        <label className="sp-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course or code"
            aria-label="Search courses"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="sp-empty-line sp-table-empty">
          {courses.length === 0
            ? "No courses yet. Add one, or import your grade sheet."
            : "No course matches this filter."}
        </p>
      ) : (
        <div className="sp-table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>
                  <button type="button" onClick={() => toggleSort("name")}>
                    Course {sortIcon("name")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("term")}>
                    Term {sortIcon("term")}
                  </button>
                </th>
                <th>Group</th>
                <th className="sp-n">
                  <button type="button" onClick={() => toggleSort("credits")}>
                    Credits {sortIcon("credits")}
                  </button>
                </th>
                <th className="sp-n">
                  <button type="button" onClick={() => toggleSort("grade")}>
                    Grade {sortIcon("grade")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("status")}>
                    Status {sortIcon("status")}
                  </button>
                </th>
                <th className="sp-n">Cost</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const grade = effectiveGrade(c);
                const estimated = c.grade === undefined && grade !== null;
                const cost =
                  c.costOverride !== undefined
                    ? c.costOverride
                    : (c.credits || 0) * config.cost.pricePerCredit;
                return (
                  <tr key={c.id} onDoubleClick={() => onEdit(c)}>
                    <td data-label="Code" className="sp-code">{c.code || "—"}</td>
                    <td data-label="Course">
                      <span className="sp-cname">
                        <i className="sp-dot" style={{ background: courseColor(c.name) }} />
                        {c.name}
                      </span>
                    </td>
                    <td data-label="Term">{termLabel(c.year, c.semester)}</td>
                    <td data-label="Group">{groupLabel(c.groupId)}</td>
                    <td data-label="Credits" className="sp-n">{formatCredits(c.credits)}</td>
                    <td data-label="Grade" className="sp-n">
                      <span
                        className={`sp-grade ${grade === null ? "sp-grade-soft" : ""} ${
                          grade !== null && grade < config.passMark ? "sp-grade-bad" : ""
                        }`}
                        title={estimated ? "Estimated from graded parts" : undefined}
                      >
                        {c.passFail && grade === null ? "pass" : formatGrade(grade)}
                        {estimated ? " est." : ""}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`sp-pill ${STATUS_CLASS[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td data-label="Cost" className="sp-n">
                      {formatMoney(cost, config.cost.currency)}
                    </td>
                    <td className="sp-row-actions">
                      <button type="button" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="sp-danger"
                        onClick={() => onDelete(c)}
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PlanCoursesTable;
