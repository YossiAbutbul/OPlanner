import { StudyState, StudySession } from "../context/StudyContext";

const COIN_PER_FOCUS_MIN = 1;
const COIN_PER_DAILY_GOAL = 50;
const STREAK_MILESTONES = [3, 7, 14, 30, 60];
const COIN_PER_MILESTONE = 100;
const COIN_PER_ACHIEVEMENT = 25;
/** Dev bonus — applied only when caller flags the user as a dev. */
const DEV_BONUS = 5_555_555;

interface EarnedBreakdown {
  fromFocus: number;
  fromDailyGoals: number;
  fromStreakMilestones: number;
  fromAchievements: number;
  total: number;
}

/**
 * Coins earned from existing focus history. Derived (not stored) so it stays in
 * sync with sessions/achievements without needing migration.
 *
 * `focusMultiplier` is applied to the per-minute focus income only (the
 * cumulative villager↔building synergy bonus). It scales retroactively over
 * all past minutes — buying a villager + building yields an instant rebate.
 */
export const computeEarnedCoins = (
  state: StudyState,
  sessions: StudySession[],
  focusMultiplier: number = 1,
  isDev: boolean = false
): EarnedBreakdown => {
  // Sum completed-focus minutes.
  let focusMs = 0;
  for (const s of sessions) {
    if (s.type === "focus" && s.completed) focusMs += s.durationMs;
  }
  const fromFocus = Math.floor(
    (focusMs / 60_000) * COIN_PER_FOCUS_MIN * focusMultiplier
  );

  // Daily-goal hits.
  const goalMs = (state.settings.dailyGoalMin || 0) * 60_000;
  let dailyHits = 0;
  if (goalMs > 0) {
    const perDay = new Map<string, number>();
    for (const s of sessions) {
      if (s.type !== "focus" || !s.completed) continue;
      const d = new Date(s.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      perDay.set(key, (perDay.get(key) || 0) + s.durationMs);
    }
    for (const ms of perDay.values()) if (ms >= goalMs) dailyHits++;
  }
  const fromDailyGoals = dailyHits * COIN_PER_DAILY_GOAL;

  // Streak milestones reached.
  let milestonesHit = 0;
  for (const m of STREAK_MILESTONES) {
    if (state.streakDays >= m) milestonesHit++;
  }
  const fromStreakMilestones = milestonesHit * COIN_PER_MILESTONE;

  const fromAchievements = state.achievements.length * COIN_PER_ACHIEVEMENT;

  const total =
    fromFocus +
    fromDailyGoals +
    fromStreakMilestones +
    fromAchievements +
    (isDev ? DEV_BONUS : 0);
  return {
    fromFocus,
    fromDailyGoals,
    fromStreakMilestones,
    fromAchievements,
    total,
  };
};

export const computeSpentCoins = (
  purchasedIds: Iterable<string>,
  allStructures: Array<{ id: string; cost: number }>
): number => {
  const byId = new Map(allStructures.map((s) => [s.id, s.cost]));
  let spent = 0;
  for (const id of purchasedIds) spent += byId.get(id) ?? 0;
  return spent;
};
