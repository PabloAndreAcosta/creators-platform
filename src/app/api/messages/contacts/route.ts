import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Use admin client to bypass RLS on profiles (users may not be public)
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role, category")
    .neq("id", user.id)
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
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
