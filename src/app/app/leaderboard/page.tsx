"use client";

import { useEffect, useState } from "react";
import { LevelBadge } from "@/components/level-badge";
import { LEVEL_COLORS } from "@/lib/points/constants";
import { cn } from "@/lib/utils";

type Period = "week" | "month" | "all";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  totalPoints: number;
  level: number;
  pointsThisWeek: number;
  pointsThisMonth: number;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "Denna vecka",
  month: "Denna m\u00e5nad",
  all: "All tid",
};

const RANK_STYLES: Record<number, string> = {
  1: "bg-yellow-500/20 border-yellow-500/40",
  2: "bg-slate-300/20 border-slate-300/40",
  3: "bg-amber-700/20 border-amber-700/40",
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/points/leaderboard?period=${period}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const getPoints = (entry: LeaderboardEntry) => {
    if (period === "week") return entry.pointsThisWeek;
    if (period === "all") return entry.totalPoints;
    return entry.pointsThisMonth;
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">Topplista</h1>
      <p className="text-white/60 text-sm mb-6">
        De mest engagerade anv\u00e4ndarna p\u00e5 Usha
      </p>

      {/* Period tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors",
              period === p
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/70"
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white/5 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <p className="text-lg mb-1">Ingen aktivitet \u00e4nnu</p>
          <p className="text-sm">Var f\u00f6rst p\u00e5 topplistan!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5",
                RANK_STYLES[entry.rank]
              )}
            >
              {/* Rank */}
              <span
                className={cn(
                  "w-8 text-center font-bold text-lg",
                  entry.rank === 1
                    ? "text-yellow-500"
                    : entry.rank === 2
                      ? "text-slate-300"
                      : entry.rank === 3
                        ? "text-amber-700"
                        : "text-white/40"
                )}
              >
                {entry.rank}
              </span>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                {entry.profile?.avatar_url ? (
                  <img
                    src={entry.profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-sm font-bold">
                    {entry.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              {/* Name + Level */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">
                    {entry.profile?.full_name || "Anonym"}
                  </span>
                  <LevelBadge level={entry.level} size="sm" />
                </div>
                <span className="text-white/40 text-xs capitalize">
                  {entry.profile?.role || ""}
                </span>
              </div>

              {/* Points */}
              <span
                className={cn(
                  "font-bold text-sm",
                  LEVEL_COLORS[entry.level] || "text-white/60"
                )}
              >
                {getPoints(entry).toLocaleString("sv-SE")} p
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
