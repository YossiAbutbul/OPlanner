import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHomework } from "../context/HomeworkContext";
import { useNotifications } from "../context/NotificationContext";
import { toIso } from "../utility/dayCalendar";
import {
  buildReminders,
  fireNotification,
  loadShown,
  markShown,
} from "../utility/notifications";
import type { HomeworkEntry, YearTreeData } from "../types/models";

// How often to re-scan while the app stays open. Drives the time-sensitive
// "starts in N min" reminders crossing their lead threshold.
const SCAN_INTERVAL_MS = 60_000;

// Reminder engine: scans the currently-selected semester's tasks + exams and
// fires desktop OS notifications. In-app only (no background push), so it runs
// on every relevant change plus a 1-minute interval while the app is open.
export const useReminders = ({
  years,
  selectedYear,
  selectedSemester,
}: {
  years: YearTreeData[];
  selectedYear: number | null;
  selectedSemester: string | null;
}): void => {
  const { getCourseTasks, homework } = useHomework();
  const { settings, permission, supported, isDesktop, requestPermission } = useNotifications();

  const [tasks, setTasks] = useState<HomeworkEntry[]>([]);

  const active = settings.enabled && supported && isDesktop;

  // Current semester's courses (name + optional finalDate).
  const courses = useMemo(() => {
    if (selectedYear === null || !selectedSemester) return [];
    const y = years.find((yy) => yy.year === selectedYear);
    const s = y?.semesters.find(
      (ss) => ss.name === selectedSemester || ss.key === selectedSemester
    );
    return s?.courses ?? [];
  }, [years, selectedYear, selectedSemester]);

  // Fetch all tasks for the semester (cached by getCourseTasks). Re-runs when
  // homework changes so newly added/edited tasks are picked up.
  useEffect(() => {
    if (!active || selectedYear === null || !selectedSemester) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Include the "reminders" pseudo-course — tasks added with "No course"
      // live there, and would otherwise never be scanned.
      const lists = await Promise.all([
        ...courses.map((c) => getCourseTasks(selectedYear, selectedSemester, c.name)),
        getCourseTasks(selectedYear, selectedSemester, "reminders"),
      ]);
      if (!cancelled) setTasks(lists.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, [active, courses, getCourseTasks, selectedYear, selectedSemester, homework]);

  // Ask for permission once, on first active use (user opted into this when
  // turning the feature on). Browsers may ignore a non-gesture prompt — the
  // settings modal offers a manual button as a fallback.
  const askedRef = useRef(false);
  useEffect(() => {
    if (!active || permission !== "default" || askedRef.current) return;
    askedRef.current = true;
    void requestPermission();
  }, [active, permission, requestPermission]);

  const runScan = useCallback(async () => {
    if (!active || permission !== "granted") return;
    const now = new Date();
    const finals = courses
      .filter((c) => c.finalDate)
      .map((c) => ({ course: c.name, finalDate: c.finalDate as string }));

    const reminders = buildReminders({ now, tasks, finals, leadMinutes: settings.leadMinutes });
    const shown = loadShown(now);
    const fresh = reminders.filter((r) => !shown[r.key]);
    if (fresh.length === 0) return;

    // Time-sensitive reminders always fire individually.
    for (const r of fresh.filter((x) => x.kind === "timed")) {
      if (await fireNotification(r.title, r.body, r.key)) markShown(r.key, now);
    }

    // Date reminders: collapse a burst into one summary so a day with many
    // deadlines doesn't spray popups. Mark all as shown either way.
    const dated = fresh.filter((x) => x.kind === "dated");
    if (dated.length <= 2) {
      for (const r of dated) {
        if (await fireNotification(r.title, r.body, r.key)) markShown(r.key, now);
      }
    } else if (dated.length > 2) {
      await fireNotification(
        `${dated.length} upcoming deadlines`,
        dated.map((r) => r.body).slice(0, 4).join(", "),
        `summary|${toIso(now)}`
      );
      for (const r of dated) markShown(r.key, now);
    }
  }, [active, permission, tasks, courses, settings.leadMinutes]);

  // Scan immediately whenever inputs change, then on a steady interval so the
  // time-based start reminders fire as their threshold is crossed.
  useEffect(() => {
    if (!active) return;
    runScan();
    const id = window.setInterval(runScan, SCAN_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, runScan]);
};
