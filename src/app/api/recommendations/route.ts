import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMatches } from "@/lib/matching/user-matches";
import { getMatchingAccess } from "@/lib/matching/flag";
import { userIsPremium } from "@/lib/matching/access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * GET /api/recommendations?role=user|creator|experience
 *
 * Server-side ranked matches. Gating (server-side, never UI-only):
 *  - matching_access="open"    → every authenticated user gets content.
 *  - matching_access="premium" → only Premium users get content; others get
 *    403 premium_required with a count-only teaser (no match content in body).
 *
 * Anonymous → 401. Rate-limited (scrape target).
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "recommendations"), 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Acceptance #4: anonymous callers must get 401, not an empty array.
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = (req.nextUrl.searchParams.get("role") || "user").toLowerCase();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 10), 20);

  // Fas 1a ships the User surface; creator/experience arrive in 1b.
  if (role !== "user") {
    return NextResponse.json(
      { recommendations: [], role, phase: "coming_soon" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const access = await getMatchingAccess();
    const admin = createAdminClient();

    // Compute matches once (capped) so we can return either content or a count.
    const all = await getUserMatches(user.id, Math.max(limit, 50));
    const count = all.length;

    if (access === "premium") {
      const premium = await userIsPremium(admin, user.id);
      if (!premium) {
        // Acceptance #5: 403 + count only. No match content in the body.
        return NextResponse.json(
          { error: "premium_required", access, count },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const matches = all.slice(0, limit);
    const recommendations = matches.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price ?? 0,
      category: r.category,
      event_date: r.event_date,
      event_location: r.event_location,
      image_url: r.image_url,
      creator_id: r.creator.id,
      profiles: { full_name: r.creator.name },
      eventTier: r.event_tier ?? "",
      bookingCount: r.bookingCount,
      creator: { id: r.creator.id, name: r.creator.name, avatar: r.creator.avatar },
      match_reasons: r.match_reasons,
      score: Math.round(r.score),
    }));

    return NextResponse.json(
      {
        recommendations,
        count,
        access,
        // Launch badge: "Premium-funktion — fri under lansering"
        launch: access === "open",
      },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
