import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyWaitlistReleased } from "@/lib/tickets/waitlist-release-notify";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Stop after this many emails in a single run so we never flood Resend; the
// rest is picked up on the next hourly run (rows stay unmarked until emailed).
const MAX_SENDS_PER_RUN = 2000;

/**
 * Cron job: email waitlist members when tickets for their event are released /
 * go on sale — the notification the confirmation email promises. Scans for
 * events that still have not-yet-release-notified waitlist rows, then hands
 * each to notifyWaitlistReleased(), which re-checks is_active + buyable +
 * not-past, walks the FIFO list, and marks rows so re-runs are safe.
 *
 * "Buyable now" can't be expressed in SQL (getSaleState is TS), so we narrow to
 * candidate listings cheaply here and let the notifier make the final call.
 * Idempotent via event_waitlist.released_notified_at → the hourly GitHub
 * Actions trigger is safe to double-fire.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: pending } = await admin
    .from("event_waitlist")
    .select("listing_id")
    .is("released_notified_at", null)
    .is("unsubscribed_at", null);

  const listingIds = [...new Set((pending ?? []).map((r) => r.listing_id))];
  if (!listingIds.length) return NextResponse.json({ candidates: 0, eligible: 0, sent: 0 });

  let sent = 0;
  let eligible = 0;
  for (const id of listingIds) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    const res = await notifyWaitlistReleased(admin, id);
    if (res.sent > 0) eligible++;
    sent += res.sent;
  }

  return NextResponse.json({ candidates: listingIds.length, eligible, sent });
}
