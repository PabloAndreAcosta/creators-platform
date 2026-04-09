import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { getServerTranslation } from "@/lib/i18n/server";
import type { PointAction } from "@/types/database";
import { LEVEL_NAMES } from "./constants";

interface AwardPointsParams {
  userId: string;
  action: PointAction;
  points: number;
  sourceId?: string;
  sourceType?: string;
}

interface AwardResult {
  totalPoints: number;
  newLevel: number;
  oldLevel: number;
  leveledUp: boolean;
  duplicate?: boolean;
}

export async function awardPoints(params: AwardPointsParams): Promise<AwardResult | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("award_points", {
    p_user_id: params.userId,
    p_action: params.action,
    p_points: params.points,
    p_source_id: params.sourceId ?? null,
    p_source_type: params.sourceType ?? null,
  });

  if (error) {
    console.error("Failed to award points:", error);
    return null;
  }

  const result = data as {
    total_points?: number;
    new_level?: number;
    old_level?: number;
    leveled_up?: boolean;
    duplicate?: boolean;
  };

  if (result.duplicate) return null;

  const awardResult: AwardResult = {
    totalPoints: result.total_points ?? 0,
    newLevel: result.new_level ?? 1,
    oldLevel: result.old_level ?? 1,
    leveledUp: result.leveled_up ?? false,
  };

  // On level-up, notify user and unlock rewards
  if (awardResult.leveledUp) {
    const levelName = LEVEL_NAMES[awardResult.newLevel] || `Level ${awardResult.newLevel}`;
    const ns = "serverNotifications";

    Promise.all([
      getServerTranslation(ns, "levelUpTitle", "sv", { level: awardResult.newLevel }),
      getServerTranslation(ns, "levelUpMsg", "sv", {
        levelName,
        points: awardResult.totalPoints,
      }),
    ])
      .then(([title, message]) =>
        createNotification({
          userId: params.userId,
          type: "queue_promoted",
          title,
          message,
          link: "/app/rewards",
        })
      )
      .catch((err) => console.error("Level-up notification failed:", err));

    // Auto-unlock rewards for the new level
    unlockRewardsForLevel(params.userId, awardResult.newLevel).catch((err) =>
      console.error("Reward unlock failed:", err)
    );
  }

  return awardResult;
}

async function unlockRewardsForLevel(userId: string, level: number) {
  const supabase = createAdminClient();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("id")
    .eq("is_active", true)
    .lte("required_level", level);

  if (!rewards || rewards.length === 0) return;

  const inserts = rewards.map((r) => ({
    user_id: userId,
    reward_id: r.id,
  }));

  await supabase
    .from("user_rewards")
    .upsert(inserts, { onConflict: "user_id,reward_id", ignoreDuplicates: true });
}
