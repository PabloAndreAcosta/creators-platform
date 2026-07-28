import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBuddyCandidates } from "@/lib/matching/buddy-matches";
import { userIsPremium } from "@/lib/matching/access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/** buddy_access feature flag (mirrors matching_access). Default open. */
async function getBuddyAccess(): Promise<"open" | "premium"> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_config").select("value").eq("key", "buddy_access").maybeSingle();
    return data?.value === "premium" ? "premium" : "open";
  } catch {
    return "open";
  }
}

/**
 * GET /api/training-buddies?style=&level=&city=&limit=
 * Ranked training-buddy candidates. Auth required; rate-limited (scrape target);
 * gated on buddy_access (open during beta). Never returns raw coordinates.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "buddies"), 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const access = await getBuddyAccess();
    if (access === "premium") {
      const admin = createAdminClient();
      if (!(await userIsPremium(admin, user.id))) {
        return NextResponse.json(
          { error: "premium_required", access },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const sp = req.nextUrl.searchParams;
    const candidates = await getBuddyCandidates(user.id, {
      style: sp.get("style") || undefined,
      level: sp.get("level") || undefined,
      city: sp.get("city") || undefined,
      limit: Math.min(Number(sp.get("limit") || 20), 20),
    });
    const buddies = candidates.map((c) => ({ ...c, score: Math.round(c.score) }));

    return NextResponse.json(
      { buddies, access, launch: access === "open" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Training-buddies error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
