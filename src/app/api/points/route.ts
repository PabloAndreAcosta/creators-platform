import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: points }, { data: recentEvents }] = await Promise.all([
    supabase
      .from("user_points")
      .select("total_points, current_level, points_this_week, points_this_month")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("point_events")
      .select("action, points, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    points: points ?? {
      total_points: 0,
      current_level: 1,
      points_this_week: 0,
      points_this_month: 0,
    },
    recentEvents: recentEvents ?? [],
  });
}
