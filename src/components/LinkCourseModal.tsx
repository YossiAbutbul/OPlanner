import React, { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import Modal from "./Modal";
import type { YearTreeData } from "../types/models";
import type { LinkCourseResult } from "../utility/initializeDatabase";
import "../css/LinkCourseModal.css";

interface Props {
  isOpen: boolean;
  course: string;
  // Where the course lives (semester key).
  from: { year: number; semester: string };
  years: YearTreeData[];
  onClose: () => void;
  onConfirm: (to: { year: number; semester: string; label: string }) => Promise<LinkCourseResult>;
}

type Row = {
  year: number;
  key: string;
  name: string;
  color?: string;
  // Why the row can't be picked, shown in place of the check.
  blocked?: string;
};

// Picks the semester a course should also show in. Nothing is copied: the
// course stays where it is and the other semester gets a pointer to it.
const LinkCourseModal: React.FC<Props> = ({ isOpen, course, from, years, onClose, onConfirm }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPicked(null);
      setBusy(false);
      setError(null);
    }
  }, [isOpen]);

  const groups = useMemo(
    () =>
      [...years]
        .sort((a, b) => a.year - b.year)
        .map((y) => ({
          year: y.year,
          rows: y.semesters.map<Row>((s) => {
            const here = y.year === from.year && s.key === from.semester;
            const taken =
              s.courses.some((c) => c.name === course) || (s.links ?? []).some((l) => l.name === course);
            return {
              year: y.year,
              key: s.key,
              name: s.name,
              color: s.color,
              blocked: here ? "Its own semester" : taken ? "Already there" : undefined,
            };
          }),
        }))
        .filter((g) => g.rows.length > 0),
    [years, from.year, from.semester, course]
  );

  const pickedRow = groups.flatMap((g) => g.rows).find((r) => `${r.year}|${r.key}` === picked) ?? null;
  const fromLabel = (() => {
    const s = years.find((y) => y.year === from.year)?.semesters.find((ss) => ss.key === from.semester);
    return `${s?.name ?? from.semester}, ${from.year}`;
  })();

  const confirm = async () => {
    if (!pickedRow || busy) return;
    setBusy(true);
    setError(null);
    const result = await onConfirm({
      year: pickedRow.year,
      semester: pickedRow.key,
      label: `${pickedRow.name}, ${pickedRow.year}`,
    });
    setBusy(false);
    if (result === "linked") onClose();
    else if (result === "taken") setError(`${pickedRow.name} already has a course with this name.`);
    else setError("Couldn't add it. Check your connection and try again.");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Show in another semester"
      footer={
        <>
          <button type="button" className="app-modal-btn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="app-modal-btn-primary"
            onClick={() => void confirm()}
            disabled={busy || !pickedRow}
          >
            {busy ? "Adding…" : "Show there"}
          </button>
        </>
      }
    >
      <p className="link-course-lead">
        <strong dir="auto">{course}</strong> stays in {fromLabel}. The semester you pick shows it
        too — the same tasks, notes and grades, kept in one place.
      </p>

      <div className="link-course-list" role="radiogroup" aria-label="Semester">
        {groups.map((g) => (
          <div key={g.year} className="link-course-group">
            <div className="link-course-year">{g.year}</div>
            {g.rows.map((r) => {
              const id = `${r.year}|${r.key}`;
              const on = picked === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!r.blocked || busy}
                  className={`link-course-row ${on ? "on" : ""}`}
                  onClick={() => {
                    setPicked(id);
                    setError(null);
                  }}
                  onDoubleClick={() => {
                    if (!r.blocked) void confirm();
                  }}
                >
                  <span
                    className="link-course-dot"
                    style={{ "--c": r.color ?? "var(--label-4)" } as React.CSSProperties}
                    aria-hidden
                  />
                  <span className="link-course-name">{r.name}</span>
                  {r.blocked ? (
                    <span className="link-course-note">{r.blocked}</span>
                  ) : (
                    <span className="link-course-check" aria-hidden>
                      {on && <Check size={15} strokeWidth={2.6} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {error && (
        <p className="link-course-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
};

export default LinkCourseModal;
