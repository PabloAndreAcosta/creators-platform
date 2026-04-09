import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rewards }, { data: userRewards }, { data: userPoints }] =
    await Promise.all([
      supabase
        .from("rewards")
        .select("*")
        .eq("is_active", true)
        .order("required_level", { ascending: true }),
      user
        ? supabase
            .from("user_rewards")
            .select("reward_id")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase
            .from("user_points")
            .select("total_points, current_level")
            .eq("user_id", user.id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const unlockedIds = new Set(
    (userRewards ?? []).map((ur) => ur.reward_id)
  );

  const enrichedRewards = (rewards ?? []).map((r) => ({
    ...r,
    unlocked: unlockedIds.has(r.id),
  }));

  return NextResponse.json({
    rewards: enrichedRewards,
    userPoints: userPoints ?? { total_points: 0, current_level: 1 },
  });
}
