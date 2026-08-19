import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createClient } from "@supabase/supabase-js";
import { sendCreatorEventEmail } from "@/lib/email/send-creator-event";
import { shouldSendEmail } from "@/lib/email/check-preferences";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron job: when a creator posts a new event, email their followers.
 * Scans active event listings created in the last 3 days (recency guard so the
 * first run doesn't blast historical events), not yet announced. Idempotent via
 * listings.followers_notified_at. Triggered hourly by GitHub Actions (Vercel
 * Hobby caps crons at once/day).
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, event_location")
    .eq("listing_type", "event")
    .eq("is_active", true)
    .is("followers_notified_at", null)
    .gte("created_at", cutoff);

  if (!listings?.length) return NextResponse.json({ listings: 0, notified: 0 });

  let notified = 0;

  for (const listing of listings) {
    // Claim the listing up front (mark BEFORE emailing) so a function timeout or
    // an overlapping cron run can't re-scan it and email the whole follower list
    // twice. Only the run that flips followers_notified_at from NULL proceeds.
    const { data: claimed } = await admin
      .from("listings")
      .update({ followers_notified_at: new Date().toISOString() })
      .eq("id", listing.id)
      .is("followers_notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { data: creator } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", listing.user_id)
      .single();

    const { data: followers } = await admin
      .from("follows")
      .select("follower_id")
      .eq("followed_id", listing.user_id);

    for (const f of followers ?? []) {
      if (!(await shouldSendEmail(f.follower_id, "notif_creator_events"))) continue;
      const { data: fp } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", f.follower_id)
        .single();
      if (!fp?.email) continue;

      try {
        await sendCreatorEventEmail({
          to: fp.email,
          followerName: fp.full_name || "där",
          creatorName: creator?.full_name || "En kreatör",
          eventTitle: listing.title || "Nytt event",
          eventDate: listing.event_date ? new Date(listing.event_date) : undefined,
          location: listing.event_location || undefined,
          eventUrl: `${appUrl}/listing/${listing.id}`,
          followerId: f.follower_id,
        });
        notified++;
      } catch (err) {
        console.error(`Creator event notify failed for follower ${f.follower_id}:`, err);
      }
    }

    // (Already marked notified up front — the claim above prevents re-scan.)
  }

  return NextResponse.json({ listings: listings.length, notified });
}
