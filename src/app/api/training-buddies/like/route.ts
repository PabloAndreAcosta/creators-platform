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
  if (!toUserId || (action !== "like" && action !== "pass") || toUserId === user.id) {
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

  if (result.matched) {
    // Notify both sides. Fetch names for a friendly message.
    const { data: names } = await admin.from("profiles").select("id, full_name").in("id", [user.id, toUserId]);
    const nameOf = (id: string) => names?.find((n: { id: string }) => n.id === id)?.full_name || "en dansare";
    await Promise.all([
      createNotification({
        userId: toUserId,
        type: "buddy_match",
        title: "Ny träningsvän-match! 🎉",
        message: `Du och ${nameOf(user.id)} matchade. Säg hej!`,
        link: "/app/training-buddies",
      }),
      createNotification({
        userId: user.id,
        type: "buddy_match",
        title: "Ny träningsvän-match! 🎉",
        message: `Du och ${nameOf(toUserId)} matchade. Säg hej!`,
        link: "/app/training-buddies",
      }),
    ]);
  }

  return NextResponse.json({ matched: result.matched });
}
