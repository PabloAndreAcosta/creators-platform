import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/training-buddies/matches
 * My mutual matches (the only surface where the "Message" CTA is offered).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("buddy_matches")
    .select("id, user_a, user_b, created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const otherIds = (rows ?? []).map((r: { user_a: string; user_b: string }) =>
    r.user_a === user.id ? r.user_b : r.user_a
  );
  const { data: profs } = otherIds.length
    ? await admin.from("profiles").select("id, full_name, avatar_url, slug").in("id", otherIds)
    : { data: [] };
  const profMap = new Map((profs ?? []).map((p: { id: string }) => [p.id, p]));

  const matches = (rows ?? []).map((r: { id: string; user_a: string; user_b: string; created_at: string }) => {
    const otherId = r.user_a === user.id ? r.user_b : r.user_a;
    const p = profMap.get(otherId) as
      | { full_name: string | null; avatar_url: string | null; slug: string | null }
      | undefined;
    return {
      id: r.id,
      created_at: r.created_at,
      user: {
        id: otherId,
        name: p?.full_name ?? null,
        avatar: p?.avatar_url ?? null,
        slug: p?.slug ?? null,
      },
    };
  });

  return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
}
