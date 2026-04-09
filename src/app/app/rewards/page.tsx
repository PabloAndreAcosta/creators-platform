"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LevelBadge } from "@/components/level-badge";
import {
  LEVEL_NAMES,
  LEVEL_COLORS,
  LEVEL_BG_COLORS,
  getLevelProgress,
  getNextLevelThreshold,
} from "@/lib/points/constants";
import { cn } from "@/lib/utils";

interface RewardData {
  id: string;
  slug: string;
  name_sv: string;
  description_sv: string;
  reward_type: string;
  required_level: number;
  icon: string | null;
  discount_percent: number | null;
  unlocked: boolean;
}

const ICON_MAP: Record<string, string> = {
  compass: "\u{1F9ED}",
  percent: "\u{1F4B0}",
  clock: "\u23F0",
  star: "\u2B50",
  headphones: "\u{1F3A7}",
  trophy: "\u{1F3C6}",
  crown: "\u{1F451}",
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [userPoints, setUserPoints] = useState({
    total_points: 0,
    current_level: 1,
  });
  const [loading, setLoading] = useState(true);
  const t = useTranslations("rewards");
  const tc = useTranslations("common");

  useEffect(() => {
    fetch("/api/points/rewards")
      .then((r) => r.json())
      .then((data) => {
        setRewards(data.rewards ?? []);
        setUserPoints(
          data.userPoints ?? { total_points: 0, current_level: 1 }
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const progress = getLevelProgress(
    userPoints.total_points,
    userPoints.current_level
  );
  const nextThreshold = getNextLevelThreshold(userPoints.current_level);
  const levelName = LEVEL_NAMES[userPoints.current_level] || "Nybörjare";
  const nextLevelName = LEVEL_NAMES[userPoints.current_level + 1];

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-white/5 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">{t("title")}</h1>

      {/* Current level card */}
      <div
        className={cn(
          "rounded-xl border border-white/10 p-5 mb-8",
          LEVEL_BG_COLORS[userPoints.current_level]
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <LevelBadge level={userPoints.current_level} size="lg" showName />
          <div className="flex-1">
            <p className="text-white/60 text-sm">
              {userPoints.total_points.toLocaleString("sv-SE")} {tc("points")}
            </p>
          </div>
        </div>

        {nextThreshold && (
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>{levelName}</span>
              <span>
                {nextLevelName} ({nextThreshold.toLocaleString("sv-SE")} p)
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  userPoints.current_level >= 7
                    ? "bg-gradient-to-r from-purple-500 to-cyan-400"
                    : "bg-white/40"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/40 mt-1">
              {t("pointsToNext", { points: (nextThreshold - userPoints.total_points).toLocaleString("sv-SE") })}
            </p>
          </div>
        )}
        {!nextThreshold && (
          <p className="text-sm text-white/60">
            {t("maxLevel")}
          </p>
        )}
      </div>

      {/* Rewards list */}
      <div className="space-y-3">
        {rewards.map((reward) => {
          const icon = ICON_MAP[reward.icon || ""] || "\u{1F381}";
          const isLocked = !reward.unlocked;
          const levelColor =
            LEVEL_COLORS[reward.required_level] || LEVEL_COLORS[1];

          return (
            <div
              key={reward.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-opacity",
                isLocked
                  ? "border-white/5 bg-white/[0.02] opacity-50"
                  : "border-white/10 bg-white/5"
              )}
            >
              <span className="text-2xl">{icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {reward.name_sv}
                  </span>
                  {reward.unlocked && (
                    <span className="text-emerald-400 text-xs">
                      {t("unlocked")}
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-sm">
                  {reward.description_sv}
                </p>
              </div>

              <div className="flex-shrink-0">
                {isLocked ? (
                  <span className={cn("text-xs font-medium", levelColor)}>
                    {tc("level")} {reward.required_level}
                  </span>
                ) : (
                  <span className="text-emerald-400 text-lg">{"\u2713"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
