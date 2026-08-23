import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type {
  CostModel,
  PlanConfig,
  PlanCourse,
  PlanCourseStatus,
  PlanImportBatch,
  PlanPayment,
  RequirementGroup,
} from "../types/models";

// All Study Plan data lives under the user subtree the Firestore rules
// already guard. Paths stay flat so each doc is small and independently
// writable — see docs/study-plan.md.
const configPath = (uid: string) => `users/${uid}/plan`;
const coursesPath = (uid: string) => `users/${uid}/planCourses`;
const paymentsPath = (uid: string) => `users/${uid}/planPayments`;
const importsPath = (uid: string) => `users/${uid}/planImports`;

export const MAX_GROUPS = 12;
export const MAX_FEES = 20;
export const MAX_COMPONENTS = 20;
export const MAX_CREDITS = 30;
export const MAX_LABEL_LEN = 120;
export const MAX_UNDO_SNAPSHOTS = 200;

export const STATUSES: PlanCourseStatus[] = [
  "COMPLETED",
  "IN_PROGRESS",
  "PLANNED",
  "EXEMPT",
  "FAILED",
  "DROPPED",
];

export const STATUS_LABEL: Record<PlanCourseStatus, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  PLANNED: "Planned",
  EXEMPT: "Exempt",
  FAILED: "Failed",
  DROPPED: "Dropped",
};

export const CURRENCIES = [
  { code: "ILS", symbol: "₪" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

export const currencySymbol = (code: string): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

export const DEFAULT_GROUPS: RequirementGroup[] = [
  { id: "mandatory", label: "Mandatory", requiredCredits: 0, color: "#1db954" },
  { id: "elective", label: "Elective", requiredCredits: 0, color: "#5b8def" },
  { id: "general", label: "General studies", requiredCredits: 0, color: "#c0a35e" },
];

export const DEFAULT_COST: CostModel = {
  currency: "ILS",
  pricingMode: "PER_CREDIT",
  pricePerCredit: 0,
  pricePerCourse: 0,
  perSemesterFee: 0,
  oneTimeFees: [],
};

export const defaultPlanConfig = (): PlanConfig => ({
  degreeName: "My degree",
  totalCreditsRequired: 120,
  groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
  cost: { ...DEFAULT_COST, oneTimeFees: [] },
  passMark: 60,
  updatedAt: Date.now(),
});

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, MAX_LABEL_LEN) : fallback;

// Drop anything malformed coming back from Firestore or a stale cache, the
// same defensive posture normalizeCourseMeta takes.
export const normalizePlanConfig = (data: unknown): PlanConfig => {
  const base = defaultPlanConfig();
  if (!data || typeof data !== "object") return base;
  const d = data as Record<string, unknown>;

  const groups = Array.isArray(d.groups)
    ? d.groups
        .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
        .filter((g) => typeof g.id === "string" && typeof g.label === "string")
        .slice(0, MAX_GROUPS)
        .map((g) => ({
          id: g.id as string,
          label: str(g.label),
          requiredCredits: Math.max(0, num(g.requiredCredits)),
          color: typeof g.color === "string" ? g.color : undefined,
        }))
    : base.groups;

  const rawCost = (d.cost ?? {}) as Record<string, unknown>;
  const fees = Array.isArray(rawCost.oneTimeFees)
    ? rawCost.oneTimeFees
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .filter((f) => typeof f.id === "string")
        .slice(0, MAX_FEES)
        .map((f) => ({
          id: f.id as string,
          label: str(f.label, "Fee"),
          amount: num(f.amount),
          paid: f.paid === true,
        }))
    : [];

  return {
    degreeName: str(d.degreeName, base.degreeName) || base.degreeName,
    institution: typeof d.institution === "string" ? str(d.institution) : undefined,
    totalCreditsRequired: Math.max(0, num(d.totalCreditsRequired, base.totalCreditsRequired)),
    groups,
    cost: {
      currency: str(rawCost.currency, "ILS") || "ILS",
      pricingMode: rawCost.pricingMode === "PER_COURSE" ? "PER_COURSE" : "PER_CREDIT",
      pricePerCredit: Math.max(0, num(rawCost.pricePerCredit)),
      pricePerCourse: Math.max(0, num(rawCost.pricePerCourse)),
      paidCoursesCap:
        typeof rawCost.paidCoursesCap === "number" && rawCost.paidCoursesCap > 0
          ? Math.floor(rawCost.paidCoursesCap)
          : undefined,
      perSemesterFee: Math.max(0, num(rawCost.perSemesterFee)),
      oneTimeFees: fees,
      semestersRemainingOverride:
        typeof rawCost.semestersRemainingOverride === "number"
          ? Math.max(0, rawCost.semestersRemainingOverride)
          : undefined,
    },
    targetAverage: typeof d.targetAverage === "number" ? d.targetAverage : undefined,
    passMark: num(d.passMark, 60),
    startYear: typeof d.startYear === "number" ? d.startYear : undefined,
    expectedEndYear: typeof d.expectedEndYear === "number" ? d.expectedEndYear : undefined,
    updatedAt: num(d.updatedAt, Date.now()),
  };
};

export const normalizePlanCourse = (id: string, data: unknown): PlanCourse | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.name !== "string" || !d.name.trim()) return null;

  const status = STATUSES.includes(d.status as PlanCourseStatus)
    ? (d.status as PlanCourseStatus)
    : "PLANNED";

  const components = Array.isArray(d.components)
    ? d.components
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .filter((c) => typeof c.id === "string")
        .slice(0, MAX_COMPONENTS)
        .map((c) => ({
          id: c.id as string,
          label: str(c.label, "Part"),
          weight: Math.min(100, Math.max(0, num(c.weight))),
          grade:
            typeof c.grade === "number" && c.grade >= 0 && c.grade <= 100
              ? c.grade
              : undefined,
        }))
    : undefined;

  return {
    id,
    code: typeof d.code === "string" ? str(d.code) : undefined,
    name: str(d.name, "Untitled course"),
    credits: Math.min(MAX_CREDITS, Math.max(0, num(d.credits))),
    status,
    year: typeof d.year === "number" ? d.year : undefined,
    semester: typeof d.semester === "string" ? str(d.semester) : undefined,
    groupId: typeof d.groupId === "string" ? d.groupId : undefined,
    grade:
      typeof d.grade === "number" && d.grade >= 0 && d.grade <= 100 ? d.grade : undefined,
    components: components && components.length ? components : undefined,
    countsToward: d.countsToward === false ? false : undefined,
    passFail: d.passFail === true ? true : undefined,
    costOverride: typeof d.costOverride === "number" ? d.costOverride : undefined,
    linkedCourse:
      d.linkedCourse && typeof d.linkedCourse === "object"
        ? (d.linkedCourse as PlanCourse["linkedCourse"])
        : undefined,
    note: typeof d.note === "string" ? d.note.slice(0, 2000) : undefined,
    source: typeof d.source === "string" ? d.source : undefined,
    updatedAt: num(d.updatedAt, Date.now()),
  };
};

export const normalizePlanPayment = (id: string, data: unknown): PlanPayment | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  return {
    id,
    date: d.date,
    amount: num(d.amount),
    kind: (typeof d.kind === "string" ? d.kind : "OTHER") as PlanPayment["kind"],
    year: typeof d.year === "number" ? d.year : undefined,
    semester: typeof d.semester === "string" ? str(d.semester) : undefined,
    note: typeof d.note === "string" ? d.note.slice(0, 300) : undefined,
    paid: d.paid !== false,
  };
};

// Firestore rejects undefined values, so strip them before every write.
const clean = <T extends object>(obj: T): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined) return;
    out[k] = v;
  });
  return out;
};

export const fetchPlanConfig = async (uid: string): Promise<PlanConfig | null> => {
  const snap = await getDoc(doc(db, configPath(uid), "config"));
  return snap.exists() ? normalizePlanConfig(snap.data()) : null;
};

export const savePlanConfig = async (uid: string, config: PlanConfig): Promise<void> => {
  await setDoc(doc(db, configPath(uid), "config"), clean({ ...config, updatedAt: Date.now() }));
};

export const fetchPlanCourses = async (uid: string): Promise<PlanCourse[]> => {
  const snap = await getDocs(collection(db, coursesPath(uid)));
  return snap.docs
    .map((d) => normalizePlanCourse(d.id, d.data()))
    .filter((c): c is PlanCourse => c !== null);
};

export const savePlanCourse = async (uid: string, course: PlanCourse): Promise<void> => {
  await setDoc(
    doc(db, coursesPath(uid), course.id),
    clean({ ...course, updatedAt: Date.now() })
  );
};

export const deletePlanCourse = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, coursesPath(uid), id));
};

export const fetchPlanPayments = async (uid: string): Promise<PlanPayment[]> => {
  const snap = await getDocs(collection(db, paymentsPath(uid)));
  return snap.docs
    .map((d) => normalizePlanPayment(d.id, d.data()))
    .filter((p): p is PlanPayment => p !== null);
};

export const savePlanPayment = async (uid: string, payment: PlanPayment): Promise<void> => {
  await setDoc(doc(db, paymentsPath(uid), payment.id), clean(payment));
};

export const deletePlanPayment = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, paymentsPath(uid), id));
};

// One import writes every touched course plus a batch record holding the
// pre-import snapshots, so "Undo import" can put everything back.
export const commitImport = async (
  uid: string,
  created: PlanCourse[],
  updated: PlanCourse[],
  before: PlanCourse[],
  meta: { fileName?: string; adapter: string }
): Promise<PlanImportBatch> => {
  const batchId = crypto.randomUUID();
  const record: PlanImportBatch = {
    id: batchId,
    createdAt: Date.now(),
    fileName: meta.fileName,
    adapter: meta.adapter,
    createdIds: created.map((c) => c.id),
    updatedBefore: before.slice(0, MAX_UNDO_SNAPSHOTS),
  };

  const writer = writeBatch(db);
  [...created, ...updated].forEach((course) => {
    writer.set(doc(db, coursesPath(uid), course.id), clean({ ...course, source: batchId }));
  });
  writer.set(doc(db, importsPath(uid), batchId), clean(record));
  await writer.commit();

  return record;
};

export const fetchImportBatches = async (uid: string): Promise<PlanImportBatch[]> => {
  const snap = await getDocs(collection(db, importsPath(uid)));
  return snap.docs
    .map((d) => d.data() as PlanImportBatch)
    .filter((b) => b && typeof b.createdAt === "number")
    .sort((a, b) => b.createdAt - a.createdAt);
};

// Undo: delete what the batch created, restore what it overwrote.
export const undoImport = async (uid: string, batch: PlanImportBatch): Promise<void> => {
  const writer = writeBatch(db);
  batch.createdIds.forEach((id) => writer.delete(doc(db, coursesPath(uid), id)));
  batch.updatedBefore.forEach((course) => {
    writer.set(doc(db, coursesPath(uid), course.id), clean(course));
  });
  writer.delete(doc(db, importsPath(uid), batch.id));
  await writer.commit();
};
