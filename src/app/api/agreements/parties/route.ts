import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

interface Party { id: string; name: string; avatar: string | null; source: "crew" | "venue" | "search" }

/**
 * GET /api/agreements/parties?q=…
 *
 * Vem kan jag skriva avtal med? Först de jag redan samarbetar med — crew på
 * mina evenemang och medlemmar i lokaler jag hör till — eftersom de ofta har
 * dolda profiler och inte går att söka fram. Sedan vanlig namnsökning bland
 * publika profiler (RLS-klienten, så inga dolda profiler läcker).
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "agreements-parties"), 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ parties: [] }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100).replace(/[%_]/g, "").trim();
  const admin = createAdminClient();
  const seen = new Set<string>();
  const parties: Party[] = [];

  const [{ data: crew }, { data: venueRows }] = await Promise.all([
    admin
      .from("listing_collaborators")
      .select("user_id, listings!inner(user_id)")
      .eq("status", "accepted")
      .eq("listings.user_id", user.id)
      .limit(100),
    admin.from("venue_members").select("user_id, venue_profile_id").eq("user_id", user.id).limit(20),
  ]);

  const ids = new Set<string>();
  for (const c of crew ?? []) if (c.user_id !== user.id) ids.add(c.user_id as string);
  const venueIds = (venueRows ?? []).map((v) => v.venue_profile_id as string);
  for (const v of venueIds) ids.add(v);
  if (venueIds.length > 0) {
    const { data: mates } = await admin.from("venue_members").select("user_id").in("venue_profile_id", venueIds).limit(100);
    for (const m of mates ?? []) if (m.user_id !== user.id) ids.add(m.user_id as string);
  }

  if (ids.size > 0) {
    let query = admin.from("profiles").select("id, full_name, avatar_url").in("id", [...ids]).limit(50);
    if (q.length >= 2) query = query.ilike("full_name", `%${q}%`);
    const { data: known } = await query;
    for (const p of known ?? []) {
      seen.add(p.id);
      parties.push({ id: p.id, name: p.full_name || "—", avatar: p.avatar_url, source: venueIds.includes(p.id) ? "venue" : "crew" });
    }
  }

  if (q.length >= 2) {
    const supabase = await createClient();
    const { data: found } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .neq("id", user.id)
      .ilike("full_name", `%${q}%`)
      .limit(10);
    for (const p of found ?? []) {
      if (seen.has(p.id)) continue;
      parties.push({ id: p.id, name: p.full_name || "—", avatar: p.avatar_url, source: "search" });
    }
  }

  return NextResponse.json({ parties });
}
