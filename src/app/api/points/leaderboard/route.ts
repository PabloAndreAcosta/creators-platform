import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") || "month";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 50);

  const supabase = await createClient();

  const orderColumn =
    period === "week"
      ? "points_this_week"
      : period === "all"
        ? "total_points"
        : "points_this_month";

  const { data, error } = await supabase
    .from("user_points")
    .select(
      `user_id, total_points, current_level, points_this_week, points_this_month,
       profiles!user_points_user_id_fkey(full_name, avatar_url, role)`
    )
    .gt(orderColumn, 0)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Kunde inte hämta topplistan" }, { status: 500 });
  }

  const leaderboard = (data ?? []).map((entry, index) => ({
    rank: index + 1,
    userId: entry.user_id,
    totalPoints: entry.total_points,
    level: entry.current_level,
    pointsThisWeek: entry.points_this_week,
    pointsThisMonth: entry.points_this_month,
    profile: (entry as any).profiles ?? null,
  }));

  return NextResponse.json({ leaderboard, period });
}
