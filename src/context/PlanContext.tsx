import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "../hooks/useLocalStorageCache";
import {
  commitImport,
  defaultPlanConfig,
  deletePlanCourse,
  deletePlanPayment,
  fetchImportBatches,
  fetchPlanConfig,
  fetchPlanCourses,
  fetchPlanPayments,
  savePlanConfig,
  savePlanCourse,
  savePlanPayment,
  undoImport,
} from "../services/plan";
import { useAuth } from "./AuthContext";
import type {
  PlanConfig,
  PlanCourse,
  PlanImportBatch,
  PlanPayment,
} from "../types/models";

interface PlanContextValue {
  config: PlanConfig;
  courses: PlanCourse[];
  payments: PlanPayment[];
  lastImport: PlanImportBatch | null;
  loaded: boolean;
  /** True until the user has stored anything — drives the empty state. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
  saveConfig: (config: PlanConfig) => Promise<void>;
  upsertCourse: (course: PlanCourse) => Promise<void>;
  removeCourse: (id: string) => Promise<void>;
  upsertPayment: (payment: PlanPayment) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
  applyImport: (
    created: PlanCourse[],
    updated: PlanCourse[],
    before: PlanCourse[],
    meta: { fileName?: string; adapter: string }
  ) => Promise<void>;
  undoLastImport: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const cacheKey = (uid: string) => `oplanner.plan.${uid}`;

interface CachedPlan {
  config: PlanConfig;
  courses: PlanCourse[];
  payments: PlanPayment[];
}

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<PlanConfig>(() => defaultPlanConfig());
  const [courses, setCourses] = useState<PlanCourse[]>([]);
  const [payments, setPayments] = useState<PlanPayment[]>([]);
  const [lastImport, setLastImport] = useState<PlanImportBatch | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Set once the config doc exists in Firestore; until then the screen shows
  // its empty state instead of a plan built from defaults.
  const [hasConfigDoc, setHasConfigDoc] = useState(false);
  const uidRef = useRef<string | null>(null);

  const writeCache = useCallback(
    (next: Partial<CachedPlan>) => {
      const uid = uidRef.current;
      if (!uid) return;
      const current = lsCache.read<CachedPlan>(cacheKey(uid)) ?? {
        config,
        courses,
        payments,
      };
      lsCache.write(cacheKey(uid), { ...current, ...next });
    },
    [config, courses, payments]
  );

  const refresh = useCallback(async () => {
    await auth.authStateReady();
    let uid: string;
    try {
      uid = requireUid();
    } catch {
      return;
    }
    uidRef.current = uid;

    try {
      const [remoteConfig, remoteCourses, remotePayments, batches] = await Promise.all([
        fetchPlanConfig(uid),
        fetchPlanCourses(uid),
        fetchPlanPayments(uid),
        fetchImportBatches(uid),
      ]);
      setConfig(remoteConfig ?? defaultPlanConfig());
      setHasConfigDoc(remoteConfig !== null);
      setCourses(remoteCourses);
      setPayments(remotePayments);
      setLastImport(batches[0] ?? null);
      lsCache.write(cacheKey(uid), {
        config: remoteConfig ?? defaultPlanConfig(),
        courses: remoteCourses,
        payments: remotePayments,
      });
    } catch (e) {
      console.error("Error loading study plan:", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Paint from cache first, then reconcile with Firestore.
  useEffect(() => {
    if (!user) {
      uidRef.current = null;
      setConfig(defaultPlanConfig());
      setCourses([]);
      setPayments([]);
      setLastImport(null);
      setHasConfigDoc(false);
      setLoaded(false);
      return;
    }
    uidRef.current = user.uid;
    const cached = lsCache.read<CachedPlan>(cacheKey(user.uid));
    if (cached?.config) {
      setConfig(cached.config);
      setCourses(Array.isArray(cached.courses) ? cached.courses : []);
      setPayments(Array.isArray(cached.payments) ? cached.payments : []);
      setHasConfigDoc(true);
      setLoaded(true);
    }
    void refresh();
  }, [user, refresh]);

  const saveConfig = useCallback(
    async (next: PlanConfig) => {
      const uid = requireUid();
      const stamped = { ...next, updatedAt: Date.now() };
      setConfig(stamped);
      setHasConfigDoc(true);
      writeCache({ config: stamped });
      await savePlanConfig(uid, stamped);
    },
    [writeCache]
  );

  const upsertCourse = useCallback(
    async (course: PlanCourse) => {
      const uid = requireUid();
      const stamped = { ...course, updatedAt: Date.now() };
      setCourses((prev) => {
        const next = prev.some((c) => c.id === stamped.id)
          ? prev.map((c) => (c.id === stamped.id ? stamped : c))
          : [...prev, stamped];
        writeCache({ courses: next });
        return next;
      });
      await savePlanCourse(uid, stamped);
    },
    [writeCache]
  );

  const removeCourse = useCallback(
    async (id: string) => {
      const uid = requireUid();
      setCourses((prev) => {
        const next = prev.filter((c) => c.id !== id);
        writeCache({ courses: next });
        return next;
      });
      await deletePlanCourse(uid, id);
    },
    [writeCache]
  );

  const upsertPayment = useCallback(
    async (payment: PlanPayment) => {
      const uid = requireUid();
      setPayments((prev) => {
        const next = prev.some((p) => p.id === payment.id)
          ? prev.map((p) => (p.id === payment.id ? payment : p))
          : [...prev, payment];
        writeCache({ payments: next });
        return next;
      });
      await savePlanPayment(uid, payment);
    },
    [writeCache]
  );

  const removePayment = useCallback(
    async (id: string) => {
      const uid = requireUid();
      setPayments((prev) => {
        const next = prev.filter((p) => p.id !== id);
        writeCache({ payments: next });
        return next;
      });
      await deletePlanPayment(uid, id);
    },
    [writeCache]
  );

  const applyImport = useCallback(
    async (
      created: PlanCourse[],
      updated: PlanCourse[],
      before: PlanCourse[],
      meta: { fileName?: string; adapter: string }
    ) => {
      const uid = requireUid();
      const record = await commitImport(uid, created, updated, before, meta);
      setLastImport(record);
      setCourses((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        [...created, ...updated].forEach((c) => byId.set(c.id, { ...c, source: record.id }));
        const next = [...byId.values()];
        writeCache({ courses: next });
        return next;
      });
    },
    [writeCache]
  );

  const undoLastImport = useCallback(async () => {
    const uid = requireUid();
    if (!lastImport) return;
    await undoImport(uid, lastImport);
    setLastImport(null);
    await refresh();
  }, [lastImport, refresh]);

  const value = useMemo<PlanContextValue>(
    () => ({
      config,
      courses,
      payments,
      lastImport,
      loaded,
      isEmpty: !hasConfigDoc && courses.length === 0,
      refresh,
      saveConfig,
      upsertCourse,
      removeCourse,
      upsertPayment,
      removePayment,
      applyImport,
      undoLastImport,
    }),
    [
      config,
      courses,
      payments,
      lastImport,
      loaded,
      hasConfigDoc,
      refresh,
      saveConfig,
      upsertCourse,
      removeCourse,
      upsertPayment,
      removePayment,
      applyImport,
      undoLastImport,
    ]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = (): PlanContextValue => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
};
