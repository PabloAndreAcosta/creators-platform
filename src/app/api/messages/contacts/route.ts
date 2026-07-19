import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
  if (!rateLimit(getRateLimitKey(req, "contacts"), 30, 60_000).allowed) {
    return NextResponse.json({ contacts: [] }, { status: 429 });
  }

  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json({ contacts: [] });
  }
  // Strip ilike wildcards + cap length so a query can't become a match-all.
  const safeQuery = query.slice(0, 100).replace(/[%_]/g, "");
  if (!safeQuery) {
    return NextResponse.json({ contacts: [] });
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Search via the RLS-respecting client so only profiles the user is allowed
  // to see (is_public = true, or their own) are returned. Do NOT use the
  // service-role client here — it would expose creators who set is_public=false.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, category")
    .neq("id", user.id)
    .ilike("full_name", `%${safeQuery}%`)
    .limit(10);

  return NextResponse.json({
    contacts: (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name || "User",
      avatar: p.avatar_url,
      role: p.role,
      category: p.category,
    })),
  });
}
