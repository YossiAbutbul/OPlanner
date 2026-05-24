import { StudyState, StudySession } from "../context/StudyContext";

export type UnlockMetric =
  | { kind: "streak"; days: number }
  | { kind: "totalHours"; hours: number }
  | { kind: "focusCount"; count: number }
  | { kind: "awards"; count: number }
  | { kind: "dailyGoalHits"; days: number };

export interface Villager {
  id: string;
  name: string;
  emoji: string;
  title: string;
  blurb: string;
  unlock: UnlockMetric;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const VILLAGERS: Villager[] = [
  {
    id: "sprout",
    name: "Sprout",
    emoji: "🌱",
    title: "The Seedling",
    blurb: "Every village starts with one tiny sprout.",
    unlock: { kind: "focusCount", count: 1 },
    rarity: "common",
  },
  {
    id: "baker",
    name: "Pippa",
    emoji: "🥐",
    title: "Village Baker",
    blurb: "Bakes croissants timed to your breaks.",
    unlock: { kind: "focusCount", count: 5 },
    rarity: "common",
  },
  {
    id: "scholar",
    name: "Eldwin",
    emoji: "📚",
    title: "Old Scholar",
    blurb: "Keeps tomes on every focused hour.",
    unlock: { kind: "totalHours", hours: 5 },
    rarity: "common",
  },
  {
    id: "knight",
    name: "Sir Cadan",
    emoji: "⚔️",
    title: "Streak Knight",
    blurb: "Guards your daily streak from the void.",
    unlock: { kind: "streak", days: 3 },
    rarity: "rare",
  },
  {
    id: "fox",
    name: "Vesper",
    emoji: "🦊",
    title: "Cunning Fox",
    blurb: "Slinks in after ten finished sessions.",
    unlock: { kind: "focusCount", count: 10 },
    rarity: "rare",
  },
  {
    id: "wizard",
    name: "Morwen",
    emoji: "🧙",
    title: "Time Wizard",
    blurb: "Bends pomodoros with arcane focus.",
    unlock: { kind: "totalHours", hours: 10 },
    rarity: "rare",
  },
  {
    id: "owl",
    name: "Athena",
    emoji: "🦉",
    title: "Night Owl",
    blurb: "Awakens after a week-long streak.",
    unlock: { kind: "streak", days: 7 },
    rarity: "epic",
  },
  {
    id: "smith",
    name: "Hilda",
    emoji: "🔨",
    title: "Forge Master",
    blurb: "Hammers a token for every goal day.",
    unlock: { kind: "dailyGoalHits", days: 5 },
    rarity: "epic",
  },
  {
    id: "bard",
    name: "Lyric",
    emoji: "🎻",
    title: "Wandering Bard",
    blurb: "Sings ballads of your fifty sessions.",
    unlock: { kind: "focusCount", count: 50 },
    rarity: "epic",
  },
  {
    id: "dragon",
    name: "Ember",
    emoji: "🐉",
    title: "Dragon of Discipline",
    blurb: "Roosts only for the truly relentless.",
    unlock: { kind: "streak", days: 30 },
    rarity: "legendary",
  },
  {
    id: "phoenix",
    name: "Sol",
    emoji: "🔥",
    title: "Phoenix of Hours",
    blurb: "Reborn after one hundred focused hours.",
    unlock: { kind: "totalHours", hours: 100 },
    rarity: "legendary",
  },
  {
    id: "elder",
    name: "Mayor Oak",
    emoji: "🌳",
    title: "Village Elder",
    blurb: "Appears once your village is well lived in.",
    unlock: { kind: "awards", count: 8 },
    rarity: "legendary",
  },
];

interface VillageStats {
  streakDays: number;
  totalHours: number;
  focusCount: number;
  awardsCount: number;
  dailyGoalHits: number;
}

export const computeVillageStats = (
  state: StudyState,
  sessions: StudySession[]
): VillageStats => {
  const focusCount = sessions.filter((s) => s.type === "focus" && s.completed).length;
  // Daily goal hits: distinct days where focus minutes >= dailyGoalMin.
  const goalMs = (state.settings.dailyGoalMin || 0) * 60_000;
  const perDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.type !== "focus" || !s.completed) continue;
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    perDay.set(key, (perDay.get(key) || 0) + s.durationMs);
  }
  let dailyGoalHits = 0;
  if (goalMs > 0) {
    for (const ms of perDay.values()) {
      if (ms >= goalMs) dailyGoalHits++;
    }
  }
  return {
    streakDays: state.streakDays,
    totalHours: state.totalFocusMs / 3_600_000,
    focusCount,
    awardsCount: state.achievements.length,
    dailyGoalHits,
  };
};

export const isUnlocked = (v: Villager, s: VillageStats): boolean => {
  switch (v.unlock.kind) {
    case "streak":
      return s.streakDays >= v.unlock.days;
    case "totalHours":
      return s.totalHours >= v.unlock.hours;
    case "focusCount":
      return s.focusCount >= v.unlock.count;
    case "awards":
      return s.awardsCount >= v.unlock.count;
    case "dailyGoalHits":
      return s.dailyGoalHits >= v.unlock.days;
  }
};

export const unlockProgress = (
  v: Villager,
  s: VillageStats
): { current: number; target: number; label: string } => {
  switch (v.unlock.kind) {
    case "streak":
      return {
        current: Math.min(s.streakDays, v.unlock.days),
        target: v.unlock.days,
        label: `${s.streakDays}/${v.unlock.days} day streak`,
      };
    case "totalHours": {
      const cur = Math.round(s.totalHours * 10) / 10;
      return {
        current: Math.min(cur, v.unlock.hours),
        target: v.unlock.hours,
        label: `${cur}h / ${v.unlock.hours}h focused`,
      };
    }
    case "focusCount":
      return {
        current: Math.min(s.focusCount, v.unlock.count),
        target: v.unlock.count,
        label: `${s.focusCount}/${v.unlock.count} focus sessions`,
      };
    case "awards":
      return {
        current: Math.min(s.awardsCount, v.unlock.count),
        target: v.unlock.count,
        label: `${s.awardsCount}/${v.unlock.count} awards`,
      };
    case "dailyGoalHits":
      return {
        current: Math.min(s.dailyGoalHits, v.unlock.days),
        target: v.unlock.days,
        label: `${s.dailyGoalHits}/${v.unlock.days} goal days`,
      };
  }
};

export const RARITY_META: Record<
  Villager["rarity"],
  { label: string; color: string; ring: string }
> = {
  common: { label: "Common", color: "#9ca3af", ring: "#e5e7eb" },
  rare: { label: "Rare", color: "#3b82f6", ring: "#bfdbfe" },
  epic: { label: "Epic", color: "#a855f7", ring: "#e9d5ff" },
  legendary: { label: "Legendary", color: "#f59e0b", ring: "#fde68a" },
};
