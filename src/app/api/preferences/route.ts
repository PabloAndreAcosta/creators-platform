import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const SKILL = ["nyborjare", "medel", "avancerad"];

/** GET /api/preferences — the signed-in user's matching preferences. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS restricts this to the caller's own row.
  const { data } = await supabase
    .from("profile_preferences")
    .select("dance_styles, skill_level, city, radius_km, looking_for, visible_in_matching, onboarding_completed_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  return NextResponse.json({ preferences: data ?? null });
}

/** PUT /api/preferences — upsert the caller's matching preferences. */
export async function PUT(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "preferences"), 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const clean = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? Array.from(new Set(arr.filter((s) => typeof s === "string").map((s) => s.trim().toLowerCase()).filter(Boolean))).slice(0, 20)
      : [];

  const row: Record<string, unknown> = {
    profile_id: user.id,
    dance_styles: clean(body.dance_styles),
    looking_for: clean(body.looking_for),
    skill_level: SKILL.includes(body.skill_level) ? body.skill_level : null,
    city: typeof body.city === "string" ? body.city.trim().slice(0, 120) || null : null,
    radius_km: Number.isFinite(body.radius_km) ? Math.min(500, Math.max(1, Math.round(body.radius_km))) : 25,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (typeof body.visible_in_matching === "boolean") {
    row.visible_in_matching = body.visible_in_matching;
  }

  const { error } = await supabase
    .from("profile_preferences")
    .upsert(row, { onConflict: "profile_id" });

  if (error) {
    console.error("preferences upsert error:", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
