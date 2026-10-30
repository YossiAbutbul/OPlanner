import { useCallback, useEffect, useRef, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "./useLocalStorageCache";
import { fetchCourseMeta, normalizeCourseMeta, saveCourseMeta } from "../services/courseMeta";
import type { CourseMeta, CourseTab } from "../types/models";

// Shared with useSemesterGrades, which reads the same cached course docs to
// work out the GPA — both must agree on the key or one would miss the other's
// writes.
export const courseMetaCacheKey = (uid: string, tab: CourseTab) =>
  `oplanner.coursemeta.${uid}.${tab.year}|${tab.semester}|${tab.course}`;

const cacheKey = (tab: CourseTab) => courseMetaCacheKey(requireUid(), tab);

// Window event for a course doc changed outside the hook that shows it (the
// assistant saving a grade sheet), so an open Grades tab and the semester
// grades follow without a reload.
export const COURSE_META_EVENT = "oplanner:course-meta";
export interface CourseMetaEventDetail {
  tab: CourseTab;
  meta: CourseMeta;
}

const sameTab = (a: CourseTab, b: CourseTab) =>
  a.year === b.year && a.semester === b.semester && a.course === b.course;

/**
 * Change one course's metadata from anywhere: reads the doc, applies
 * `update`, writes the changed keys, refreshes the cache and tells every
 * hook showing that course.
 */
export const updateCourseMeta = async (
  tab: CourseTab,
  update: (meta: CourseMeta) => Partial<CourseMeta>
): Promise<void> => {
  const uid = requireUid();
  const current = await fetchCourseMeta(uid, tab.year, tab.semester, tab.course);
  const patch = update(current);
  await saveCourseMeta(uid, tab.year, tab.semester, tab.course, patch);
  const meta = { ...current, ...patch };
  lsCache.write(courseMetaCacheKey(uid, tab), meta);
  window.dispatchEvent(
    new CustomEvent<CourseMetaEventDetail>(COURSE_META_EVENT, { detail: { tab, meta } })
  );
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

  useEffect(() => {
    if (!tab) return;
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<CourseMetaEventDetail>).detail;
      if (d && sameTab(d.tab, tab)) setMeta(d.meta);
    };
    window.addEventListener(COURSE_META_EVENT, onChange);
    return () => window.removeEventListener(COURSE_META_EVENT, onChange);
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
