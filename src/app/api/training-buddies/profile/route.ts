import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const ROLES = new Set(["leader", "follower", "both"]);
const norm = (s: string) => s.trim().toLowerCase();

/**
 * GET  → my buddy profile, or a `prefill` hydrated from profile_preferences.
 * PUT  → opt in / update (REQUIRES BankID verification).
 * DELETE → pause (is_active=false), keeps the row.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: prof }] = await Promise.all([
    admin.from("training_buddy_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    admin.from("profiles").select("bankid_verified_at, location").eq("id", user.id).maybeSingle(),
  ]);
  const bankidVerified = !!prof?.bankid_verified_at;

  if (profile) {
    return NextResponse.json({ profile, bankidVerified }, { headers: { "Cache-Control": "no-store" } });
  }

  // Prefill from the event-matching preferences so onboarding is pre-populated.
  const { data: prefs } = await admin
    .from("profile_preferences")
    .select("dance_styles, skill_level, city, radius_km")
    .eq("profile_id", user.id)
    .maybeSingle();
  const styles: string[] = (prefs?.dance_styles ?? []).map(norm);
  const styleLevels: Record<string, string> = {};
  if (prefs?.skill_level) for (const s of styles) styleLevels[s] = prefs.skill_level;

  return NextResponse.json(
    {
      profile: null,
      bankidVerified,
      prefill: {
        dance_styles: styles,
        style_levels: styleLevels,
        buddy_role: "both",
        availability: { days: [], windows: [] },
        city: prefs?.city ?? prof?.location ?? null,
        radius_km: prefs?.radius_km ?? 25,
        bio: "",
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "buddyprofile"), 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // BankID gate — the pool is identity-verified for safe in-person meetups.
  const { data: prof } = await admin.from("profiles").select("bankid_verified_at").eq("id", user.id).maybeSingle();
  if (!prof?.bankid_verified_at) {
    return NextResponse.json({ error: "bankid_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dance_styles: string[] = Array.isArray(body.dance_styles)
    ? body.dance_styles.map((s: unknown) => norm(String(s))).filter(Boolean).slice(0, 20)
    : [];
  const buddy_role = ROLES.has(body.buddy_role) ? body.buddy_role : "both";
  const radius_km = Math.max(1, Math.min(500, Number(body.radius_km) || 25));
  const styleSet = new Set(dance_styles);
  const style_levels: Record<string, string> = {};
  if (body.style_levels && typeof body.style_levels === "object") {
    for (const [k, v] of Object.entries(body.style_levels)) {
      const key = norm(String(k));
      if (styleSet.has(key) && typeof v === "string") style_levels[key] = v;
    }
  }
  const days = Array.isArray(body.availability?.days) ? body.availability.days.map((d: unknown) => norm(String(d))) : [];
  const windows = Array.isArray(body.availability?.windows) ? body.availability.windows.map((w: unknown) => norm(String(w))) : [];
  const bio = typeof body.bio === "string" ? body.bio.slice(0, 500) : null;
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lon = typeof body.lon === "number" ? body.lon : null;
  const city = typeof body.city === "string" ? body.city.slice(0, 120) : null;

  const { error } = await admin.from("training_buddy_profiles").upsert(
    {
      profile_id: user.id,
      is_active: true,
      dance_styles,
      style_levels,
      buddy_role,
      availability: { days, windows },
      city,
      lat,
      lon,
      radius_km,
      bio,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
  if (error) {
    console.error("buddy profile upsert:", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("training_buddy_profiles").update({ is_active: false, updated_at: new Date().toISOString() }).eq("profile_id", user.id);
  return NextResponse.json({ ok: true });
}
