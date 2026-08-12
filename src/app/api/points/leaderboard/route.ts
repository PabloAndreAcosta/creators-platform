import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") || "month";
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 50);

    const supabase = await createClient();

    const orderColumn =
      period === "week"
        ? "points_this_week"
        : period === "all"
          ? "total_points"
          : "points_this_month";

    const { data: points, error } = await supabase
      .from("user_points")
      .select(
        "user_id, total_points, current_level, points_this_week, points_this_month"
      )
      .gt(orderColumn, 0)
      .order(orderColumn, { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "Kunde inte hämta topplistan" }, { status: 500 });
    }

    // Profiles are fetched in a separate query rather than via a PostgREST embed:
    // user_points.user_id has its FK to auth.users (not profiles), so the embed
    // `profiles!user_points_user_id_fkey(...)` cannot be resolved and 500s.
    const userIds = (points ?? []).map((p) => p.user_id);
    const profileMap = new Map<
      string,
      { full_name: string | null; avatar_url: string | null; role: string | null }
    >();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, {
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
        });
      }
    }

    const leaderboard = (points ?? []).map((entry, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      totalPoints: entry.total_points,
      level: entry.current_level,
      pointsThisWeek: entry.points_this_week,
      pointsThisMonth: entry.points_this_month,
      profile: profileMap.get(entry.user_id) ?? null,
    }));

    return NextResponse.json({ leaderboard, period });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
