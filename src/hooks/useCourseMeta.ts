import { useCallback, useEffect, useRef, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "./useLocalStorageCache";
import { fetchCourseMeta, normalizeCourseMeta, saveCourseMeta } from "../services/courseMeta";
import type { CourseMeta, CourseTab } from "../types/models";

const cacheKey = (tab: CourseTab) => {
  const uid = requireUid();
  return `oplanner.coursemeta.${uid}.${tab.year}|${tab.semester}|${tab.course}`;
};

// Course-page metadata for the active course tab. Stale-while-revalidate:
// serve the localStorage copy immediately, then refresh with one Firestore
// read. Saves are optimistic — state + cache update first, Firestore write
// after; on failure the previous state is restored and the error rethrown
// so the caller can toast.
export const useCourseMeta = (tab: CourseTab | null) => {
  const [meta, setMeta] = useState<CourseMeta>({});
  const [loading, setLoading] = useState(false);
  // Guards against a slow fetch for a previous course landing after the
  // user already switched tabs.
  const tabKeyRef = useRef<string>("");

  useEffect(() => {
    if (!tab) {
      setMeta({});
      return;
    }
    const tabKey = `${tab.year}|${tab.semester}|${tab.course}`;
    tabKeyRef.current = tabKey;
    let cancelled = false;

    (async () => {
      await auth.authStateReady();
      let key: string;
      try { key = cacheKey(tab); } catch { return; }

      const cached = lsCache.read<CourseMeta>(key);
      if (cached && !cancelled) setMeta(normalizeCourseMeta(cached));
      else setLoading(true);

      try {
        const fresh = await fetchCourseMeta(requireUid(), tab.year, tab.semester, tab.course);
        if (cancelled || tabKeyRef.current !== tabKey) return;
        setMeta(fresh);
        lsCache.write(key, fresh);
      } catch (e) {
        console.error("Error fetching course meta:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tab?.year, tab?.semester, tab?.course]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (patch: Partial<CourseMeta>) => {
    if (!tab) return;
    let prev: CourseMeta = {};
    setMeta((m) => { prev = m; return { ...m, ...patch }; });
    try {
      const key = cacheKey(tab);
      lsCache.write(key, { ...prev, ...patch });
      await saveCourseMeta(requireUid(), tab.year, tab.semester, tab.course, patch);
    } catch (e) {
      setMeta(prev);
      try { lsCache.write(cacheKey(tab), prev); } catch { /* signed out */ }
      throw e;
    }
  }, [tab?.year, tab?.semester, tab?.course]); // eslint-disable-line react-hooks/exhaustive-deps

  return { meta, loading, save };
};
