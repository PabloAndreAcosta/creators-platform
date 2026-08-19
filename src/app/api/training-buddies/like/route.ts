import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordBuddyLike } from "@/lib/matching/buddy-matches";
import { createNotification } from "@/lib/notifications/create";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/training-buddies/like  { toUserId, action: "like" | "pass" }
 * Records the action; on a reciprocal like, creates the match + notifies both.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "buddylike"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { toUserId, action } = await req.json().catch(() => ({}));
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Validate the id shape before it flows into a PostgREST .or() filter below
  // (prevents filter-structure injection / block bypass).
  if (!toUserId || !UUID_RE.test(toUserId) || (action !== "like" && action !== "pass") || toUserId === user.id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Target must be an active pool member and not blocked in either direction.
  const [{ data: target }, { data: block }] = await Promise.all([
    admin.from("training_buddy_profiles").select("is_active").eq("profile_id", toUserId).maybeSingle(),
    admin.from("user_blocks").select("blocker_id")
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${toUserId}),and(blocker_id.eq.${toUserId},blocked_id.eq.${user.id})`)
      .maybeSingle(),
  ]);
  if (!target?.is_active || block) {
    return NextResponse.json({ error: "unavailable" }, { status: 409 });
  }

  const result = await recordBuddyLike(user.id, toUserId, action);

  // Only notify when THIS call created the match — avoids duplicate pings when
  // both users like simultaneously (only one insert wins → one isNew).
  if (result.matched && result.isNew) {
    // Notify both sides. Fetch names for a friendly message.
    const { data: names } = await admin.from("profiles").select("id, full_name").in("id", [user.id, toUserId]);
    const nameOf = (id: string) =>
      names?.find((n: { id: string }) => n.id === id)?.full_name as string | undefined;
    // A nameless profile falls back to "another dancer" — a phrase, so it comes
    // from a message of its own rather than being frozen into the params.
    const match = (userId: string, otherId: string) =>
      createNotification({
        userId,
        type: "buddy_match" as const,
        titleKey: "buddyMatchTitle",
        bodyKey: nameOf(otherId) ? "buddyMatchMsg" : "buddyMatchMsgAnon",
        params: nameOf(otherId) ? { name: nameOf(otherId)! } : undefined,
        link: "/app/training-buddies",
      });
    await Promise.all([match(toUserId, user.id), match(user.id, toUserId)]);
  }

  return NextResponse.json({ matched: result.matched });
}
