import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildListingPostMessage } from "@/lib/facebook/listing-post";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// How many days before an event's date to auto-publish its Facebook post.
const LEAD_DAYS = 3;
const GRAPH = "https://graph.facebook.com/v22.0";

/**
 * Cron job: auto-publish a Facebook page post for each upcoming event that the
 * creator opted into (fb_auto_post), ~LEAD_DAYS before its date. This spreads a
 * recurring series out as a drip of timely posts instead of one upfront blast.
 *
 * Eligible = active, opted-in, event_date within [today, today+LEAD_DAYS], not
 * already on Facebook (facebook_event_id null) and not already auto-posted
 * (fb_reminder_posted_at null). Idempotent via fb_reminder_posted_at, so the
 * hourly GitHub Actions trigger is safe to double-fire.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const windowEnd = new Date(today.getTime() + LEAD_DAYS * 86400000).toISOString().slice(0, 10);

  const { data: listings } = await admin
    .from("listings")
    .select("id, user_id, title, description, price, slug, image_url")
    .eq("is_active", true)
    .eq("fb_auto_post", true)
    .is("facebook_event_id", null)
    .is("fb_reminder_posted_at", null)
    .gte("event_date", todayStr)
    .lte("event_date", windowEnd);

  if (!listings?.length) return NextResponse.json({ eligible: 0, posted: 0 });

  // Cache page tokens per creator to avoid refetching within one run.
  const connByUser = new Map<string, { pageId: string; token: string } | null>();
  let posted = 0;

  for (const listing of listings) {
    let conn = connByUser.get(listing.user_id);
    if (conn === undefined) {
      const { data: social } = await admin
        .from("social_connections")
        .select("facebook_page_id, facebook_page_access_token")
        .eq("user_id", listing.user_id)
        .single();
      conn =
        social?.facebook_page_id && social?.facebook_page_access_token
          ? { pageId: social.facebook_page_id, token: social.facebook_page_access_token }
          : null;
      connByUser.set(listing.user_id, conn);
    }
    // No connected page — leave it; it can post once the creator connects.
    if (!conn) continue;

    const message = buildListingPostMessage(listing, appUrl);

    try {
      const endpoint = listing.image_url
        ? `${GRAPH}/${conn.pageId}/photos`
        : `${GRAPH}/${conn.pageId}/feed`;
      const body: Record<string, string> = { message, access_token: conn.token };
      if (listing.image_url) body.url = listing.image_url;

      const fbRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!fbRes.ok) {
        const err = await fbRes.json().catch(() => ({}));
        console.error(`event-reminders: FB post failed for ${listing.id}:`, err?.error?.message);
        continue;
      }

      const fbData = await fbRes.json();
      const fbPostId = fbData.post_id || fbData.id;

      await admin
        .from("listings")
        .update({
          facebook_event_id: fbPostId,
          fb_reminder_posted_at: new Date().toISOString(),
        })
        .eq("id", listing.id);

      posted++;
    } catch (err) {
      console.error(`event-reminders: error posting ${listing.id}:`, err);
    }
  }

  return NextResponse.json({ eligible: listings.length, posted });
}
