import { useEffect, useMemo, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "./useLocalStorageCache";
import { COURSE_META_EVENT, courseMetaCacheKey, type CourseMetaEventDetail } from "./useCourseMeta";
import { fetchCourseMeta, normalizeCourseMeta } from "../services/courseMeta";
import { semesterGpa, summarize } from "../utility/grades";
import { countedRows, withAutoExam } from "../utility/gradeSheet";
import type { CourseInfo, CourseMeta } from "../types/models";

export interface CourseGrade {
  course: string;
  // The course grade so far, or null when nothing in it is graded yet.
  grade: number | null;
  credits: number;
  // True once every item on the sheet has a score.
  complete: boolean;
  // Share of the course grade already marked, 0–100.
  gradedWeight: number;
  // The sheet's weights total, when some are set but they don't add up to
  // 100; else null.
  weightOff: number | null;
  // The course has a sheet but no weights on it yet (an import leaves them
  // for the student to set).
  weightsUnset: boolean;
}

// Every course's grade sheet for one semester, and the GPA they add up to.
// Reads the same course docs useCourseMeta does, through the same cache, so
// opening the Grades tab after editing a sheet shows the new figure without
// waiting for Firestore.
export const useSemesterGrades = (year: number, semester: string, courses: CourseInfo[]) => {
  const [metas, setMetas] = useState<Record<string, CourseMeta>>({});
  const [loading, setLoading] = useState(false);

  // Course names alone: a colour or final-date edit shouldn't refetch.
  const courseNamesKey = courses.map((c) => c.name).sort().join("|");

  useEffect(() => {
    const names = courseNamesKey ? courseNamesKey.split("|") : [];
    if (!names.length) {
      setMetas({});
      return;
    }
    let cancelled = false;

    (async () => {
      await auth.authStateReady();
      let uid: string;
      try { uid = requireUid(); } catch { return; }

      const cached: Record<string, CourseMeta> = {};
      for (const course of names) {
        const hit = lsCache.read<CourseMeta>(courseMetaCacheKey(uid, { year, semester, course }));
        if (hit) cached[course] = normalizeCourseMeta(hit);
      }
      if (!cancelled && Object.keys(cached).length) setMetas(cached);
      else if (!cancelled) setLoading(true);

      try {
        const fresh = await Promise.all(
          names.map(async (course) => [course, await fetchCourseMeta(uid, year, semester, course)] as const)
        );
        if (cancelled) return;
        // Keep the cache current, so the next visit opens on these figures.
        for (const [course, meta] of fresh) lsCache.write(courseMetaCacheKey(uid, { year, semester, course }), meta);
        setMetas(Object.fromEntries(fresh));
      } catch (e) {
        console.error("Error fetching semester grades:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [year, semester, courseNamesKey]);

  // A course changed elsewhere (the assistant saving its weights).
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<CourseMetaEventDetail>).detail;
      if (!d || d.tab.year !== year || d.tab.semester !== semester) return;
      setMetas((m) => ({ ...m, [d.tab.course]: d.meta }));
    };
    window.addEventListener(COURSE_META_EVENT, onChange);
    return () => window.removeEventListener(COURSE_META_EVENT, onChange);
  }, [year, semester]);

  const byCourse = useMemo<CourseGrade[]>(
    () =>
      courses.map((c) => {
        const meta = metas[c.name];
        // The exam's share as the Grades tab shows it, even when the stored
        // sheet predates it filling in.
        const items = withAutoExam(meta?.gradeItems ?? [], meta?.gradeCap);
        const s = summarize(countedRows(items, meta?.gradeCap).counted);
        return {
          course: c.name,
          grade: s.final ?? s.soFar,
          credits: meta?.credits ?? 0,
          complete: s.final !== null,
          gradedWeight: Math.min(100, s.gradedWeight),
          weightOff: s.totalWeight > 0 && !s.balanced ? s.totalWeight : null,
          weightsUnset: items.length > 0 && s.totalWeight === 0,
        };
      }),
    [courses, metas]
  );

  const gpa = useMemo(
    () =>
      semesterGpa(
        byCourse
          .filter((c): c is CourseGrade & { grade: number } => c.grade !== null)
          .map((c) => ({ grade: c.grade, credits: c.credits }))
      ),
    [byCourse]
  );

  return { byCourse, gpa, loading };
};
