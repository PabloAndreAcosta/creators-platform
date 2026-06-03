import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
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
    .select("id, full_name, avatar_url, role")
    .neq("id", user.id)
    .ilike("full_name", `%${query}%`)
    .limit(10);

  return NextResponse.json({
    contacts: (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name || "User",
      avatar: p.avatar_url,
      role: p.role,
    })),
  });
}
