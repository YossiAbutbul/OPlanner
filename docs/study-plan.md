# Study Plan (feature shape)

Degree-level view of the whole degree: every course you finished, are taking or
still plan to take, with credits, grades and money. It sits next to the
existing per-semester planner and never duplicates it. No tasks, no calendar,
no reminders live here.

Design language: [`docs/design.md`](design.md). Visual mockup: the published
Study Plan artifact.

---

## 1. Goal and non-goals

**Goal.** One screen that answers four questions:

1. How far into the degree am I? (credits done / required, by requirement group)
2. How am I doing? (weighted average, per-year trend, grades per course
   including exam and assignment components)
3. What has it cost, and what will it cost? (paid, committed, projected to
   graduation)
4. When do I finish? (semesters left, expected graduation term)

**Non-goals.**

- No tasks, deadlines, reminders or calendars. Those stay in the semester views.
- No scraping of the university site and no university credentials. The user
  exports a file from the portal, or pastes the table; parsing happens
  client-side.
- No course catalog or prerequisite solver in v1. Prerequisites are stored but
  only surfaced as a warning, not enforced.

---

## 2. Where it lives

- New sidebar nav item **Study Plan** (lucide `GraduationCap`), same
  `.sidebar-nav` slot as Focus, above the footer.
- Selecting it opens a full-page view that replaces the `MainContent` column,
  exactly like `PomodoroPage` does today (`App.tsx` holds `planOpen` state,
  passes `planActive` / `onOpenPlan` to `Sidebar`).
- The right sidebar stays mounted (Upcoming / Day still make sense) but the
  page is self-contained and readable without it.
- Global by definition: no year or semester selection affects it.

---

## 3. Data model

New types in `src/types/models.ts`:

```ts
export type PlanCourseStatus =
  | "COMPLETED" | "IN_PROGRESS" | "PLANNED" | "EXEMPT" | "FAILED" | "DROPPED";

// One graded component of a course: exam, midterm, assignment average, lab.
export interface GradeComponent {
  id: string;
  label: string;        // "Final exam", "Assignments", "Lab"
  weight: number;       // 0..100, should sum to 100 (warn, don't block)
  grade?: number;       // 0..100, blank while unknown
}

export interface PlanCourse {
  id: string;           // crypto.randomUUID()
  code?: string;        // catalog number from the portal, the dedupe key
  name: string;
  credits: number;      // 0..30
  status: PlanCourseStatus;
  year?: number;        // academic year, e.g. 2025
  semester?: string;    // "Semester A" | "Semester B" | "Semester C"
  groupId?: string;     // requirement group (mandatory, elective, general, ...)
  grade?: number;       // final grade, 0..100
  components?: GradeComponent[];
  countsToward?: boolean;   // false = audited / not counted in credits or average
  passFail?: boolean;       // excluded from the weighted average
  costOverride?: number;    // per-course cost when it deviates from the model
  prereqCodes?: string[];
  linkedCourse?: { year: number; semester: string; course: string }; // planner course
  source?: string;      // "manual" | importBatchId
  updatedAt: number;
}

export interface RequirementGroup {
  id: string;
  label: string;        // "Mandatory", "Elective", "General studies"
  requiredCredits: number;
  color?: string;
}

export type PricingMode = "PER_CREDIT" | "PER_COURSE";

export interface CostModel {
  currency: string;         // "ILS" default, symbol resolved for display
  pricingMode?: PricingMode;// undefined = PER_CREDIT (legacy docs)
  pricePerCredit: number;
  pricePerCourse?: number;  // schools that bill a whole course
  paidCoursesCap?: number;  // pay for N courses, the rest of the degree is free
  perSemesterFee: number;   // registration, welfare, insurance
  oneTimeFees: { id: string; label: string; amount: number }[];
  semestersRemainingOverride?: number;
}

export interface PlanPayment {
  id: string;
  date: string;             // YYYY-MM-DD
  amount: number;           // negative for a refund or scholarship
  kind: "TUITION" | "FEE" | "BOOKS" | "SCHOLARSHIP" | "REFUND" | "OTHER";
  year?: number;
  semester?: string;
  note?: string;
  paid: boolean;            // false = scheduled / due
}

export interface PlanConfig {
  degreeName: string;       // "B.Sc. Software Engineering"
  institution?: string;
  totalCreditsRequired: number;
  groups: RequirementGroup[];
  cost: CostModel;
  targetAverage?: number;
  passMark: number;         // 60 default
  startYear?: number;
  expectedEndYear?: number;
  updatedAt: number;
}
```

Firestore paths (all under the existing `users/{uid}` subtree, so
`firestore.rules` already covers them; the 50-field cap is satisfied by every
doc above):

```
users/{uid}/plan/config          PlanConfig          (single doc)
users/{uid}/planCourses/{id}     PlanCourse
users/{uid}/planPayments/{id}    PlanPayment
users/{uid}/planImports/{id}     { id, createdAt, source, fileName, courseIds[] }
```

`planImports` exists so a bad import can be undone as a batch.

Rules addendum (optional hardening, matching the existing style): cap
`components` at 20 entries, `groups` at 12, `oneTimeFees` at 20.

Client state: `PlanContext` (mirrors `HomeworkContext`), with
`useLocalStorageCache` for instant paint and a Firestore read behind it.

---

## 4. Derived metrics

Computed in `src/hooks/usePlanStats.ts`, pure and unit-testable.

```
counted        = courses.filter(c => c.countsToward !== false)
creditsDone    = sum(credits) where status COMPLETED or EXEMPT
creditsActive  = sum(credits) where status IN_PROGRESS
creditsPlanned = sum(credits) where status PLANNED
creditsLeft    = max(0, totalCreditsRequired - creditsDone)
progressPct    = round(creditsDone / totalCreditsRequired * 100)

average        = sum(grade * credits) / sum(credits)
                 over COMPLETED, graded, not passFail, countsToward
projected      = same, plus IN_PROGRESS courses using the weighted component
                 estimate (sum(weight * grade) / sum(weight of graded parts))
courseGrade    = explicit grade, else the component estimate when weights
                 cover 100%, else blank

spent          = sum(payments where paid)
due            = sum(payments where !paid)        // already billed
coursesBilled  = count of COMPLETED / IN_PROGRESS / FAILED / DROPPED courses
coursesLeft    = paidCoursesCap ? max(0, cap - coursesBilled) : null
coursesAhead   = max(plannedCourses, ceil(creditsToBuy / avgCreditsPerCourse))
tuitionAhead   = PER_COURSE ? min(coursesAhead, coursesLeft ?? Inf) * pricePerCourse
                            : creditsLeft * pricePerCredit
projectedLeft  = max(0, tuitionAhead + perSemesterFee * semestersRemaining
                 + sum(unpaid oneTimeFees) - due)   // due is already itemized
totalDegree    = spent + due + projectedLeft
costPerCredit  = spent / max(1, creditsDone)      // reality check vs the model

semestersRemaining = override ?? ceil(creditsLeft / avgCreditsPerSemester)
graduationTerm     = startYear + semesters walked forward over A/B/C terms
```

Per group: `done / required` with the same low/mid/high level thresholds the
semester stat bar uses (34% / 67%).

Edge cases that must be covered by tests: zero required credits, no graded
courses, a failed retake of a course that also has a passing attempt (the
passing attempt counts, the failed one shows in history with credits 0),
`passFail` courses adding credits but not average, exempt courses adding
credits with no grade.

---

## 5. Import from the university portal

Pipeline, all client-side:

```
file or paste  ->  detect adapter  ->  parse to raw rows  ->  column mapping
               ->  normalize + validate  ->  diff vs existing  ->  preview
               ->  commit batch  ->  undo record
```

**Accepted inputs**

| Input | Notes |
| --- | --- |
| `.csv` / `.tsv` | Grade sheet or degree audit exported from the portal |
| `.html` file or pasted table | Most Israeli portals render grades as an HTML table; parsed with `DOMParser`, text only, never injected into the DOM |
| Pasted text | Tab or multi-space separated, the copy-paste path from a portal page |
| Open University page | `תכניות לימודים אישיות` copied from sheilta, or the text of the PDF printed from it: one course per block (`code - name credits סטטוס:`, then `רמה`, `סמסטר`, `נכלל?`). The adapter also reads `נקודות זכות בתכנית` and offers to set it as the required credits, and offers to create the levels (`רגיל`, `מתקדם`, ...) as requirement groups |
| `.ics` | Already supported for schedules, unchanged, not a Study Plan source |

**Adapters.** `src/utility/planImport/` holds a registry:

```ts
interface PlanImportAdapter {
  id: string;                        // "generic-csv", "moodle-grades", "braude-audit"
  detect(text: string): number;      // confidence 0..1
  parse(text: string): RawPlanRow[]; // { code, name, credits, grade, year, semester, group, cost }
}
```

The generic CSV adapter is the fallback and always available; portal-specific
adapters only improve auto-detection of columns. Header matching is
case-insensitive and bilingual (Hebrew and English aliases per field, for
example credits: `נק"ז`, `נקודות זכות`, `credits`, `points`).

**Mapping step.** A column-mapping table is always shown, pre-filled with the
adapter's guesses, so an unknown portal still imports in two clicks. Numbers
accept `85.5`, `85`, `פטור` (exempt), `עובר` (pass).

**Diff and idempotency.** Match order: `code`, then normalized name plus
year and semester. The preview lists **New / Updated / Unchanged** with a
per-row checkbox; updates show old value struck through next to the new one.
Re-importing an updated sheet never duplicates a course, matching the promise
the `.ics` import already makes.

**Safety.** Row cap 1000, file cap 2MB, parsing wrapped in try/catch with a
toast on failure. Nothing from the file is ever rendered as HTML. The whole
batch writes through `writeBatch` and records a `planImports` doc so
"Undo import" restores the previous state.

---

## 6. Screen shape

```
Study Plan
├─ Header      degree name + institution, "Import" + "Settings" buttons
├─ Stat strip  Credits (wide, progress bar) | Average | Spent | Left to pay | Graduation
├─ Grid (2 cols, 1 on mobile)
│   ├─ Requirements    one row per group: label, done/required, bar, remaining
│   ├─ Grades          bar chart of the weighted average per academic year,
│   │                  target line, current average called out in text
│   ├─ Money           spent vs projected split bar, payment list (last 5),
│   │                  "Add payment", cost per credit reality check
│   └─ Timeline        semesters left, expected graduation term, credits per
│                      remaining semester needed to hit it
└─ Courses table  code | course | year/sem | group | credits | grade | status | cost
                  filter chips (All / Completed / In progress / Planned),
                  group-by-year toggle, sort by any column, row click opens
                  the course drawer
```

**Course drawer / modal.** Name, code, credits, group, status, final grade,
component rows (label, weight, grade) with a computed weighted result, cost
override, link to the planner course (which surfaces its task and exam
progress read-only, so the degree view and the semester view stay in sync
without copying data).

**Settings modal.** Degree name, institution, total credits, requirement
groups (add / rename / required credits / color), pass mark, target average,
currency, price per credit, per-semester fee, one-time fees, start year,
expected end year.

**Empty state.** Same shape as the semester empty state: circle icon,
"Let's map out your degree", one sentence, primary "Import from your
university", secondary "Add a course", then three hints (credits tracked,
average calculated, costs projected).

**Mobile.** Stat strip becomes a 2-column grid, the panel grid collapses to one
column, the courses table becomes a card list (course name, then a
credits / grade / status row), modals become bottom sheets.

All of it uses the existing tokens and recipes: white cards on
`#e3e3e6` borders, `1.7rem/700` stat values, `999px` status pills, accent-green
progress fills, lucide icons at 16/18.

---

## 7. Files

New

```
src/components/StudyPlanPage.tsx
src/components/StudyPlan/PlanStats.tsx
src/components/StudyPlan/RequirementsPanel.tsx
src/components/StudyPlan/GradesPanel.tsx
src/components/StudyPlan/MoneyPanel.tsx
src/components/StudyPlan/TimelinePanel.tsx
src/components/StudyPlan/PlanCoursesTable.tsx
src/components/StudyPlan/PlanCourseModal.tsx
src/components/StudyPlan/PlanSettingsModal.tsx
src/components/StudyPlan/ImportPlanModal.tsx
src/context/PlanContext.tsx
src/hooks/usePlanStats.ts
src/services/plan.ts                    // Firestore reads/writes, batch import, undo
src/utility/planImport/index.ts         // adapter registry + detect
src/utility/planImport/csv.ts
src/utility/planImport/htmlTable.ts
src/utility/planImport/normalize.ts     // aliases, number parsing, dedupe keys
src/css/StudyPlan.css
```

Changed

```
src/App.tsx                 planOpen state, render StudyPlanPage, wrap in PlanProvider
src/components/Sidebar.tsx  Study Plan nav item (GraduationCap)
src/types/models.ts         the types above
firestore.rules             optional list-size caps for plan docs
docs/design.md              already covers the shared language
```

Tests (vitest, matching the existing `*.test.ts` placement)

```
src/hooks/usePlanStats.test.ts          credits, average, projections, edge cases
src/utility/planImport/csv.test.ts      header aliases, Hebrew values, malformed rows
src/utility/planImport/normalize.test.ts dedupe and diff behavior
```

---

## 8. Phases

| Phase | Ships | Definition of done |
| --- | --- | --- |
| M1 Skeleton | Nav item, page shell, `PlanContext`, config doc, settings modal, manual add/edit course, stat strip, courses table | You can hand-enter a degree and see credits and average |
| M2 Money | Cost model, payments list, money panel, projections | Spent / left / total answer the cost question |
| M3 Import | CSV plus HTML adapters, mapping step, diff preview, batch commit, undo | An exported grade sheet fills the plan in two clicks with no duplicates |
| M4 Depth | Grade components, per-year grades chart, timeline panel, link to planner courses, mobile card list polish | The screen answers all four questions from section 1 |

---

## 9. Open questions

1. Grading scale: assume 0-100 with a 60 pass mark (Israeli standard) and make
   the pass mark configurable, or support a 4.0 GPA scale as well in v1?
   PDF import: the Open University PDF has to be copy-pasted as text today.
   Reading the PDF directly would need a parser dependency (~300KB).
2. Retakes: keep every attempt in history, or keep only the counted attempt?
   Current plan keeps both, counts one.
3. Currency: default `ILS` with a symbol map, or a free-text symbol field?
4. Should completed planner courses auto-seed the plan on first open (read the
   year/semester tree, create `PLANNED` entries with blank credits), or stay
   fully manual until the first import?
