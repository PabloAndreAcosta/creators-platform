import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 300; // cache 5 min

// Public, aggregate-only platform numbers for the landing page social-proof
// strip. No PII — counts only.
export async function GET() {
  try {
    const admin = createAdminClient();
    const [events, creators, checkIns, venues] = await Promise.all([
      admin.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_public", true),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_public", true),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .not("checked_in_at", "is", null),
      admin
        .from("listings")
        .select("event_location")
        .eq("is_active", true)
        .eq("is_public", true)
        .not("event_location", "is", null),
    ]);

    const cities = new Set(
      (venues.data ?? [])
        .map((v) => (v.event_location ?? "").split(",").pop()?.trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return NextResponse.json({
      events: events.count ?? 0,
      creators: creators.count ?? 0,
      checkIns: checkIns.count ?? 0,
      cities,
    });
  } catch {
    return NextResponse.json({ events: 0, creators: 0, checkIns: 0, cities: 0 });
  }
}
