import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNLOCK_COSTS, EVENT_PACK } from "@/lib/capabilities/config";
import { ensureMonthlyAllowance } from "@/lib/tokens/allowance";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/tokens/unlock — spend nycklar to unlock a capability for one of the
 * caller's own events. Atomic (balance check + debit + unlock in one DB tx);
 * idempotent per (listing, capability). Never gates the buyer checkout flow.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "tokens-unlock"), 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { capability, listingId } = await req.json().catch(() => ({}));
  const cost = UNLOCK_COSTS[capability as string];
  if (cost == null) return NextResponse.json({ error: "invalid_capability" }, { status: 400 });
  if (!listingId) return NextResponse.json({ error: "listing_required" }, { status: 400 });

  const admin = createAdminClient();

  // Only unlock capabilities for your own event.
  const { data: listing } = await admin
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Credit this month's tier allowance first (idempotent) so a subscriber can
  // spend their monthly pot on the unlock without buying nycklar.
  const { data: profile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();
  await ensureMonthlyAllowance(admin, user.id, profile?.tier);

  const { data, error } = await admin.rpc("unlock_capability", {
    p_profile: user.id,
    p_capability: capability,
    p_listing: listingId,
    p_cost: cost,
  });

  if (error) {
    console.error("unlock_capability error:", error.message);
    return NextResponse.json({ error: "unlock_failed" }, { status: 500 });
  }
  if (!data?.ok) {
    // e.g. insufficient balance
    return NextResponse.json({ error: data?.error ?? "unlock_failed", balance: data?.balance }, { status: 402 });
  }

  // Unlocking the event pack publishes a draft the host parked while gated —
  // the "create paid event → unlock → it goes live" flow. Only flips their own
  // inactive listing; never deactivates anything.
  if (capability === EVENT_PACK) {
    await admin
      .from("listings")
      .update({ is_active: true })
      .eq("id", listingId)
      .eq("user_id", user.id)
      .eq("is_active", false);
  }

  return NextResponse.json(data); // { ok, balance, already? }
}
