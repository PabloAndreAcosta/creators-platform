import type { PointAction } from "@/types/database";

export const POINT_VALUES: Record<PointAction, number> = {
  like_given: 1,
  like_received: 2,
  follow_given: 2,
  follow_received: 3,
  booking_made: 10,
  booking_received: 15,
  review_written: 5,
  review_received: 5,
  post_created: 3,
  referral_signup: 20,
  profile_completed: 10,
};

export const LEVEL_THRESHOLDS = [
  { level: 1, points: 0 },
  { level: 2, points: 50 },
  { level: 3, points: 150 },
  { level: 4, points: 300 },
  { level: 5, points: 600 },
  { level: 6, points: 1200 },
  { level: 7, points: 2500 },
  { level: 8, points: 5000 },
  { level: 9, points: 10000 },
] as const;

export const LEVEL_NAMES: Record<number, string> = {
  1: "Nybörjare",
  2: "Utforskare",
  3: "Engagerad",
  4: "Aktiv",
  5: "Dedikerad",
  6: "Expert",
  7: "Mästare",
  8: "Legend",
  9: "Ikon",
};

export const LEVEL_COLORS: Record<number, string> = {
  1: "text-gray-400 border-gray-400",
  2: "text-amber-600 border-amber-600",
  3: "text-slate-400 border-slate-400",
  4: "text-yellow-500 border-yellow-500",
  5: "text-emerald-500 border-emerald-500",
  6: "text-blue-500 border-blue-500",
  7: "text-purple-500 border-purple-500",
  8: "text-red-500 border-red-500",
  9: "text-cyan-400 border-cyan-400",
};

export const LEVEL_BG_COLORS: Record<number, string> = {
  1: "bg-gray-400/20",
  2: "bg-amber-600/20",
  3: "bg-slate-400/20",
  4: "bg-yellow-500/20",
  5: "bg-emerald-500/20",
  6: "bg-blue-500/20",
  7: "bg-purple-500/20",
  8: "bg-red-500/20",
  9: "bg-gradient-to-r from-cyan-400/20 to-purple-400/20",
};

export const ACTION_LABELS: Record<PointAction, string> = {
  like_given: "Gillade ett inlägg",
  like_received: "Fick en like",
  follow_given: "Följde en kreatör",
  follow_received: "Fick en följare",
  booking_made: "Bokade ett event",
  booking_received: "Fick en bokning",
  review_written: "Skrev en recension",
  review_received: "Fick en recension",
  post_created: "Skapade ett inlägg",
  referral_signup: "Värvade en ny användare",
  profile_completed: "Fyllde i profilen",
};

export function getLevelForPoints(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i].points) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
}

export function getNextLevelThreshold(currentLevel: number): number | null {
  const next = LEVEL_THRESHOLDS.find((t) => t.level === currentLevel + 1);
  return next?.points ?? null;
}

export function getLevelProgress(totalPoints: number, currentLevel: number): number {
  const currentThreshold = LEVEL_THRESHOLDS.find((t) => t.level === currentLevel)?.points ?? 0;
  const nextThreshold = getNextLevelThreshold(currentLevel);
  if (!nextThreshold) return 100;
  const progress = ((totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
