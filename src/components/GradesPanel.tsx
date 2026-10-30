import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Plus, Scale, Sparkles, Trash2 } from "lucide-react";
import { useCourseMeta } from "../hooks/useCourseMeta";
import { useToast } from "../context/ToastContext";
import RollingNumber from "./RollingNumber";
import { MAX_CREDITS, MAX_GRADE_ITEMS, MAX_GRADE_LABEL_LEN } from "../services/courseMeta";
import { fillUnweighted, formatGrade, summarize } from "../utility/grades";
import {
  assignmentKey,
  FINAL_SKIP,
  looksLikeFinal,
  orderSheet,
  reconcileWithImport,
  sheetFromTasks,
  withAutoExam,
  countedRows,
} from "../utility/gradeSheet";
import type { TaskLike } from "../utility/gradeSheet";
import { FINAL_TASK_ID, isImportedTaskId } from "../services/homework";
import type { CourseTab, GradeItem, HomeworkEntry } from "../types/models";
import "../css/GradesPanel.css";

interface Props {
  activeTab: CourseTab;
  // The course's own tasks: an imported calendar already names every
  // assignment, so the sheet starts from those instead of placeholders.
  tasks: HomeworkEntry[];
}

const row = (label: string, weight: number): GradeItem => ({
  id: crypto.randomUUID(),
  label,
  weight,
});

// A course that has never been graded opens on a sheet built from its own
// tasks: its imported assignments and an exam row (unless the student
// removed it). Nothing is written until the student changes something, so
// visiting the tab leaves no data behind.
const defaultSheet = (tasks: TaskLike[], skip: ReadonlySet<string>): GradeItem[] =>
  (sheetFromTasks(tasks, skip) ?? []).map((d) => row(d.label, d.weight));

// A number the user is part-way through typing: an empty field and "8." are
// both states the input has to allow, so values are only clamped on commit.
const parseNumber = (raw: string, max: number): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, 0), max);
};

// Score pills, in the same family as the overview's countdown pills: strong
// marks green, a pass neutral, a fail red. 60 is the pass mark here.
const PASS_MARK = 60;
const STRONG_MARK = 85;

const scoreTone = (score: number) => {
  if (score >= STRONG_MARK) return "good";
  if (score >= PASS_MARK) return "near";
  return "under";
};

// Enter commits a field the way leaving it does.
const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") e.currentTarget.blur();
};

const GradesPanel: React.FC<Props> = ({ activeTab, tasks }) => {
  const { meta, save } = useCourseMeta(activeTab);
  const toast = useToast();

  const taskList = useMemo<TaskLike[]>(
    () =>
      tasks.map((t) => ({
        name: t.name,
        dueDate: t.dueDate,
        isFinal: t.id === FINAL_TASK_ID,
        isImported: isImportedTaskId(t.id),
      })),
    [tasks]
  );
  // Only the names and dates matter here, so a status or colour edit doesn't
  // rebuild the sheet.
  const taskKey = taskList
    .map((t) => `${t.name}|${t.dueDate}|${t.isFinal}|${t.isImported}`)
    .join("~");

  // undefined means the course has never had a sheet, so it opens on one
  // built from its tasks. An empty array means the student emptied it, and
  // stays empty. An existing sheet keeps every row as it is, and only picks
  // up assignments it doesn't already have.
  const [items, setItems] = useState<GradeItem[]>([]);
  // The sheet this panel last wrote. Its own saves come straight back through
  // meta; syncing those with the import again would undo the edit that was
  // just made, so they are taken as they are.
  const lastSaved = useRef<GradeItem[] | null>(null);
  // A row just added with "Add item": its name field takes the cursor.
  const focusId = useRef<string | null>(null);
  useEffect(() => {
    const stored = meta.gradeItems;
    const skip = new Set(meta.gradeSkips ?? []);
    if (stored && stored === lastSaved.current) {
      setItems(stored);
      return;
    }

    // No sheet yet: build one from the course's imported assignments, or the
    // generic shape when it has none.
    if (!stored) {
      setItems(defaultSheet(taskList, skip));
      return;
    }
    // Otherwise keep what the student has filled in and line the rest up with
    // the import, exam row included.
    const reconciled = reconcileWithImport(stored, taskList, () => crypto.randomUUID(), skip);
    // Imports append, so a later one can leave 03 after 05: read in order.
    setItems(withAutoExam(orderSheet(reconciled ?? stored), meta.gradeCap));
    // taskKey stands in for taskList: same names and dates, same sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.gradeItems, meta.gradeSkips, meta.gradeCap, taskKey]);

  // A course whose assignments count only up to a weight: the rows past it
  // are shown but left out of every figure.
  const cap = meta.gradeCap;
  const { counted, dropped } = useMemo(() => countedRows(items, cap), [items, cap]);
  const summary = useMemo(() => summarize(counted), [counted]);
  const assignmentCount = items.filter((i) => !looksLikeFinal(i.label)).length;
  // What the exam would take on auto, so blurring its field unchanged
  // doesn't count as typing a weight.
  const autoExamWeight = useMemo(() => {
    const exam = items.find((i) => looksLikeFinal(i.label));
    return exam
      ? withAutoExam(items.map((i) => (i === exam ? { ...i, fixedWeight: false } : i)), cap).find(
          (i) => i.id === exam.id
        )!.weight
      : 0;
  }, [items, cap]);
  const ungraded = counted.filter((i) => i.score === undefined).length;
  // No weights at all is where an imported sheet starts: a prompt, not an
  // error. Some weights that miss 100 is the error.
  const weightsUnset = items.length > 0 && summary.totalWeight === 0;
  const weightOff = items.length > 0 && !weightsUnset && !summary.balanced;
  const balanced = useMemo(() => fillUnweighted(items), [items]);
  // The bar is the course's 0–100 scale: points banked, points already lost
  // on graded items, and what is still open.
  const lost = Math.max(0, summary.gradedWeight - summary.earned);
  const open = Math.max(0, 100 - summary.gradedWeight);

  // Optimistic: the sheet re-renders from local state, the write follows.
  // Every save recomputes the exam's share, so it follows the other weights.
  const commit = async (edited: GradeItem[], capNow: number | undefined = cap) => {
    const next = withAutoExam(edited, capNow);
    setItems(next);
    lastSaved.current = next;
    try {
      await save({ gradeItems: next });
    } catch {
      toast.error("Could not save the grade sheet.");
    }
  };

  const patchItem = (id: string, patch: Partial<GradeItem>) =>
    commit(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // score is optional, so clearing the field deletes the key rather than
  // writing undefined, which Firestore rejects.
  const withScore = (list: GradeItem[], id: string, score: number | undefined): GradeItem[] =>
    list.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i };
      if (score === undefined) delete next.score;
      else next.score = score;
      return next;
    });

  // Dropping a row the calendar supplied is a decision, so it is recorded:
  // without that, the next reconcile would add the assignment back.
  const removeItem = async (item: GradeItem) => {
    const before = items;
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    lastSaved.current = next;
    // Deleting the exam row says the course has no exam; deleting an
    // imported assignment says it doesn't count. Both are kept off the sheet.
    const key = looksLikeFinal(item.label) ? FINAL_SKIP : assignmentKey(item.label);
    const remember = key === FINAL_SKIP || taskList.some((t) => assignmentKey(t.name) === key);
    const skips = meta.gradeSkips ?? [];
    const patch =
      remember && !skips.includes(key)
        ? { gradeItems: next, gradeSkips: [...skips, key] }
        : { gradeItems: next };
    try {
      await save(patch);
    } catch {
      toast.error("Could not save the grade sheet.");
      return;
    }
    // A scored row is easy to lose by a stray tap; put it back on request,
    // skip list included, so the import doesn't treat it as dismissed.
    toast.info(`Removed ${item.label || "item"}.`, {
      action: {
        label: "Undo",
        onClick: () => {
          setItems(before);
          lastSaved.current = before;
          save({ gradeItems: before, gradeSkips: skips }).catch(() =>
            toast.error("Could not save the grade sheet.")
          );
        },
      },
    });
  };

  const addItem = () => {
    if (items.length >= MAX_GRADE_ITEMS) {
      toast.info(`A course holds up to ${MAX_GRADE_ITEMS} graded items.`);
      return;
    }
    const added = { ...row("", 0), manual: true };
    focusId.current = added.id;
    commit([...items, added]);
  };

  // Changing what the assignments can add moves the exam's share with it.
  const saveCap = async (next: number | undefined) => {
    try {
      await save({ gradeCap: next ?? null } as Parameters<typeof save>[0]);
      await commit(items, next);
    } catch {
      toast.error("Could not save that.");
    }
  };

  const saveCredits = async (credits: number) => {
    try {
      await save({ credits });
    } catch {
      toast.error("Could not save that.");
    }
  };

  const tiles = [
    { key: "graded", label: "Graded", value: summary.gradedWeight, zero: summary.gradedWeight === 0 },
    { key: "left", label: "To come", value: summary.remainingWeight, zero: summary.remainingWeight === 0 },
  ];

  return (
    <div className="gp">
      {/* Same shape as the semester summary: figure and bar on the left, the
          list it comes from on the right. */}
      <section className="gp-card" aria-label="Course grade">
        <div className="gp-summary">
          <div className="gp-figure">
            {summary.soFar === null ? (
              <span className="gp-figure-none">No marks yet</span>
            ) : (
              <>
                <span className="gp-figure-value">
                  <RollingNumber value={Math.round(summary.final ?? summary.soFar)} />
                </span>
                <span className="gp-figure-label">{summary.final !== null ? "final" : "so far"}</span>
              </>
            )}
          </div>

          <div
            className="gp-bar"
            role="img"
            aria-label={`${formatGrade(summary.earned)} points banked, ${formatGrade(lost)} lost, ${formatGrade(open)} still open`}
          >
            {summary.earned > 0 && (
              <span className="gp-bar-seg gp-bar-earned" style={{ flexGrow: summary.earned }} />
            )}
            {lost > 0 && <span className="gp-bar-seg gp-bar-lost" style={{ flexGrow: lost }} />}
            {open > 0 && <span className="gp-bar-seg gp-bar-left" style={{ flexGrow: open }} />}
          </div>

          <dl className="gp-tiles">
            {tiles.map((t) => (
              <div key={t.key} className={`gp-tile gp-tile-${t.key}`} data-zero={t.zero || undefined}>
                <dd><RollingNumber value={Math.round(t.value)} suffix="%" /></dd>
                <dt>{t.label}</dt>
              </div>
            ))}
            <div
              className="gp-tile gp-tile-best"
              data-zero={summary.remainingWeight === 0 || undefined}
            >
              <dd><RollingNumber value={Math.round(summary.ceiling)} /></dd>
              <dt>At best</dt>
            </div>
          </dl>

          <p className="gp-answer">
            {ungraded === 0
              ? "Everything on the sheet is graded."
              : `${ungraded} ${ungraded === 1 ? "item" : "items"} still to grade.`}
          </p>

          <div className="gp-meta" aria-label="Credits">
            <div className="gp-meta-set">
              <label htmlFor="gp-credits">Credits</label>
              <input
                id="gp-credits"
                className="gp-meta-input"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_CREDITS}
                step={0.5}
                key={`credits-${meta.credits ?? "none"}`}
                defaultValue={meta.credits ?? ""}
                placeholder="0"
                onKeyDown={blurOnEnter}
                onBlur={(e) => {
                  const next = parseNumber(e.target.value, MAX_CREDITS) ?? 0;
                  if (next !== (meta.credits ?? 0)) saveCredits(next);
                }}
              />
            </div>
            <span className="gp-meta-note">counts this course toward the semester average</span>
            {assignmentCount > 1 && (
              <div className="gp-meta-set">
                <label htmlFor="gp-cap">Assignments count up to</label>
                <input
                  id="gp-cap"
                  className="gp-meta-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.5}
                  key={`cap-${cap ?? "all"}`}
                  defaultValue={cap ?? ""}
                  placeholder="all"
                  onKeyDown={blurOnEnter}
                  onBlur={(e) => {
                    const n = parseNumber(e.target.value, 100);
                    const next = n && n > 0 ? n : undefined;
                    if (next !== cap) saveCap(next);
                  }}
                />
                <span className="gp-meta-of">%</span>
              </div>
            )}
          </div>
        </div>

        <div className="gp-sheet">
          <div className="gp-sheet-head">
            <span className="gp-sheet-title">Graded items</span>
            <span className={`gp-sheet-total${weightOff ? " gp-sheet-total-off" : ""}`}>
              {formatGrade(summary.totalWeight)}% of the grade
            </span>
          </div>

          {/* The weights are the grade's formula: until they total 100 the
              course has no final grade, so say so plainly and say by how much. */}
          {weightsUnset && (
            <div className="gp-note">
              <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
              <span className="gp-note-text">
                Set each item's share of the grade, or tell the assistant the weights and it will fill them in.
              </span>
            </div>
          )}

          {weightOff && (
            <div className="gp-error" role="alert">
              <AlertCircle size={15} strokeWidth={2.2} aria-hidden="true" />
              <span className="gp-error-text">
                Weights must add up to 100%.{" "}
                {summary.totalWeight < 100
                  ? `${formatGrade(100 - summary.totalWeight)}% is missing.`
                  : `They are ${formatGrade(summary.totalWeight - 100)}% over.`}
              </span>
              {balanced && (
                <button
                  type="button"
                  className="gp-balance"
                  onClick={() => commit(balanced)}
                  title="Split the missing weight across the rows that have none"
                >
                  <Scale size={13} strokeWidth={2.2} />
                  <span>Fill to 100%</span>
                </button>
              )}
            </div>
          )}

          <ul className="gp-list">
            {items.map((item) => (
              <li key={item.id}>
                <div className={`gp-item${dropped.has(item.id) ? " gp-item-dropped" : ""}`}>
                  <span className="gp-item-weight">
                    <input
                      className="gp-weight"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={item.weight}
                      aria-label={`Weight of ${item.label || "item"} in percent`}
                      onChange={(e) =>
                        setItems((l) =>
                          l.map((i) =>
                            i.id === item.id ? { ...i, weight: Number(e.target.value) || 0 } : i
                          )
                        )
                      }
                      onKeyDown={blurOnEnter}
                      onBlur={(e) => {
                        const typed = parseNumber(e.target.value, 100);
                        if (looksLikeFinal(item.label)) {
                          // The exam follows the other rows on its own. Typing a
                          // different weight keeps that number; clearing the
                          // field hands it back to the rule.
                          if (typed === undefined) {
                            const { fixedWeight: _fixed, ...rest } = item;
                            void _fixed;
                            commit(items.map((i) => (i.id === item.id ? rest : i)));
                          } else if (typed !== autoExamWeight || item.fixedWeight) {
                            patchItem(item.id, { weight: typed, fixedWeight: typed !== autoExamWeight });
                          }
                          return;
                        }
                        patchItem(item.id, { weight: typed ?? 0 });
                      }}
                    />
                    <span className="gp-weight-unit" aria-hidden="true">%</span>
                  </span>

                  <input
                    className="gp-name"
                    type="text"
                    value={item.label}
                    maxLength={MAX_GRADE_LABEL_LEN}
                    placeholder="Name this item"
                    ref={(el) => {
                      if (el && focusId.current === item.id) {
                        focusId.current = null;
                        el.focus();
                      }
                    }}
                    aria-label="Item name"
                    onChange={(e) =>
                      setItems((l) =>
                        l.map((i) => (i.id === item.id ? { ...i, label: e.target.value } : i))
                      )
                    }
                    onKeyDown={blurOnEnter}
                    onBlur={(e) => patchItem(item.id, { label: e.target.value.trim() })}
                  />

                  {dropped.has(item.id) ? (
                    <span className="gp-dropped" title={`Assignments count up to ${cap}%, best marks first`}>
                      not counted
                    </span>
                  ) : (
                    item.score !== undefined &&
                    item.weight > 0 && (
                      <span className="gp-points" title="Points this item adds to the course grade">
                        +{formatGrade((item.score * item.weight) / 100)}
                      </span>
                    )
                  )}

                  <input
                    className={`gp-score${
                      item.score === undefined ? " gp-score-empty" : ` gp-score-${scoreTone(item.score)}`
                    }`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={item.score ?? ""}
                    placeholder="Score"
                    aria-label={`Score for ${item.label || "item"}`}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setItems((l) => withScore(l, item.id, raw === "" ? undefined : Number(raw)));
                    }}
                    onKeyDown={blurOnEnter}
                    onBlur={(e) => commit(withScore(items, item.id, parseNumber(e.target.value, 100)))}
                  />

                  <button
                    type="button"
                    className="gp-remove"
                    aria-label={`Remove ${item.label || "item"}`}
                    onClick={() => removeItem(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button type="button" className="gp-add" onClick={addItem}>
            <Plus size={15} strokeWidth={2.4} />
            <span>Add item</span>
          </button>
        </div>
      </section>

    </div>
  );
};

export default GradesPanel;
