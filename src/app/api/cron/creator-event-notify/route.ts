import { NextRequest, NextResponse } from "next/server";
import { activeEmailFollowers } from "@/lib/follows/email-follow";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createClient } from "@supabase/supabase-js";
import { sendCreatorEventEmail } from "@/lib/email/send-creator-event";
import { shouldSendEmail } from "@/lib/email/check-preferences";
import { buildNotifyAudience } from "@/lib/venues/audience";
import { groupForAnnouncement, announcementUrl, type AnnounceGroup, type AnnounceListing } from "@/lib/follows/announce-groups";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron job: when a creator posts a new event, email their followers.
 * Scans active event listings PUBLISHED in the last 3 days (published_at, set
 * by a trigger when is_active becomes true — a draft activated a week after it
 * was created is still news). Rows with no published_at predate the column and
 * are skipped, so historical events are never blasted. Idempotent via
 * listings.followers_notified_at. Triggered hourly by GitHub Actions.
 *
 * One mail per series, not per evening: evenings sharing series_id are grouped
 * (lib/follows/announce-groups.ts) and announced together with the count and
 * first date. Standalone evenings are one mail each, as before.
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
    .select("id, user_id, title, event_date, event_location, series_id, series_slug, venue_profile_id, venue_confirmed_at")
    .eq("listing_type", "event")
    .eq("is_active", true)
    .is("followers_notified_at", null)
    .gte("published_at", cutoff);

  if (!listings?.length) return NextResponse.json({ listings: 0, notified: 0 });

  let notified = 0;
  let emailNotified = 0;

  for (const candidate of groupForAnnouncement(listings)) {
    // Claim the evenings up front (mark BEFORE emailing) so a function timeout
    // or an overlapping cron run can't re-scan them and email the whole
    // follower list twice. Only the evenings this run flipped from NULL count.
    const { data: claimedRows } = await admin
      .from("listings")
      .update({ followers_notified_at: new Date().toISOString() })
      .in("id", candidate.listings.map((l) => l.id))
      .is("followers_notified_at", null)
      .select("id");
    const group = reclaim(candidate, claimedRows);
    if (!group) continue;
    const listing = group.first;

    const { data: creator } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", listing.user_id)
      .single();

    const accountEmails = new Set<string>();
    const { data: followers } = await admin
      .from("follows")
      .select("follower_id")
      .eq("followed_id", listing.user_id);

    const audience = buildNotifyAudience({
      creatorFollowers: (followers ?? []).map((f) => f.follower_id),
      creatorId: listing.user_id,
    });

    for (const followerId of audience) {
      if (!(await shouldSendEmail(followerId, "notif_creator_events"))) continue;
      const { data: fp } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", followerId)
        .single();
      if (!fp?.email) continue;
      accountEmails.add(fp.email.toLowerCase());

      try {
        await sendCreatorEventEmail({
          to: fp.email,
          followerName: fp.full_name || "där",
          creatorName: creator?.full_name || "En kreatör",
          ...mailFields(group, appUrl),
          followerId,
        });
        notified++;
      } catch (err) {
        console.error(`Creator event notify failed for follower ${followerId}:`, err);
      }
    }

    // Följare utan konto (biljettköpare som sagt ja, eller bekräftat via mejl).
    emailNotified += await notifyEmailFollowers({
      admin,
      followedId: listing.user_id,
      skipEmails: accountEmails,
      creatorName: creator?.full_name || "En kreatör",
      group,
      appUrl,
    });
  }

  // ---- Andra omgången: lokalens följare ------------------------------------
  //
  // Egen omgång med egen stämpel, eftersom lokalens godkännande nästan alltid
  // kommer EFTER att arrangörens följare redan fått besked. Slogs de ihop blev
  // evenemanget stämplat vid första körningen och lokalens följare fick aldrig
  // veta något — vilket var hela poängen med kopplingen.
  const { data: venueListings } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, event_location, series_id, series_slug, venue_profile_id")
    .eq("listing_type", "event")
    .eq("is_active", true)
    .not("venue_profile_id", "is", null)
    .not("venue_confirmed_at", "is", null)
    .is("venue_followers_notified_at", null);

  let venueNotified = 0;
  let venueEmailNotified = 0;

  // Ett mejl per serie och lokal, som ovan. Lokalen säger ja kväll för kväll,
  // så kvällar som bekräftas i olika körningar blir olika utskick — men allt
  // som bekräftats sedan förra körningen går ut som ett.
  for (const candidate of groupForAnnouncement(venueListings ?? [], (l) => l.venue_profile_id)) {
    // Claima före utskick, som ovan: en timeout eller överlappande körning ska
    // inte kunna mejla samma följarlista två gånger.
    const { data: claimedRows } = await admin
      .from("listings")
      .update({ venue_followers_notified_at: new Date().toISOString() })
      .in("id", candidate.listings.map((l) => l.id))
      .is("venue_followers_notified_at", null)
      .select("id");
    const group = reclaim(candidate, claimedRows);
    if (!group) continue;
    const listing = group.first;

    const [{ data: venue }, { data: creator }, { data: vf }] = await Promise.all([
      admin.from("profiles").select("full_name, company_name").eq("id", listing.venue_profile_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", listing.user_id).maybeSingle(),
      admin.from("follows").select("follower_id").eq("followed_id", listing.venue_profile_id),
    ]);

    // Arrangörens egna följare fick redan besked i första omgången. Den som
    // följer båda ska inte få två mejl om samma kväll.
    const { data: cf } = await admin
      .from("follows")
      .select("follower_id")
      .eq("followed_id", listing.user_id);
    const redanNotifierade = new Set((cf ?? []).map((f) => f.follower_id));

    const audience = buildNotifyAudience({
      creatorFollowers: [],
      venueFollowers: (vf ?? []).map((f) => f.follower_id).filter((id) => !redanNotifierade.has(id)),
      creatorId: listing.user_id,
      venueId: listing.venue_profile_id,
    });

    const accountEmails = new Set<string>();
    const venueName = (venue?.company_name || venue?.full_name || "").trim();

    for (const followerId of audience) {
      if (!(await shouldSendEmail(followerId, "notif_creator_events"))) continue;
      const { data: fp } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", followerId)
        .single();
      if (!fp?.email) continue;
      accountEmails.add(fp.email.toLowerCase());

      try {
        await sendCreatorEventEmail({
          to: fp.email,
          followerName: fp.full_name || "där",
          // Mejlet kommer för att man följer LOKALEN, så det är lokalens namn
          // mottagaren känner igen. Arrangören står i texten via titeln.
          creatorName: venueName || creator?.full_name || "En lokal",
          ...mailFields(group, appUrl),
          followerId,
        });
        venueNotified++;
      } catch (err) {
        console.error(`Venue event notify failed for follower ${followerId}:`, err);
      }
    }

    // Lokalens e-postföljare, minus de som redan fick kvällen via arrangören.
    for (const ef of await activeEmailFollowers(admin, listing.user_id)) accountEmails.add(ef.email);
    venueEmailNotified += await notifyEmailFollowers({
      admin,
      followedId: listing.venue_profile_id,
      skipEmails: accountEmails,
      creatorName: venueName || creator?.full_name || "En lokal",
      group,
      appUrl,
    });
  }

  return NextResponse.json({
    listings: listings.length,
    notified,
    venueListings: venueListings?.length ?? 0,
    venueNotified,
    emailNotified,
    venueEmailNotified,
  });
}

/**
 * Gruppen som den här körningen faktiskt äger: bara kvällarna vars stämpel den
 * själv satte. En överlappande körning som hann före tar resten.
 */
function reclaim<L extends AnnounceListing>(
  group: AnnounceGroup<L>,
  claimedRows: { id: string }[] | null
): AnnounceGroup<L> | null {
  const claimed = new Set((claimedRows ?? []).map((r) => r.id));
  const listings = group.listings.filter((l) => claimed.has(l.id));
  if (listings.length === 0) return null;
  return { key: group.key, listings, first: listings[0], count: listings.length };
}

/** Det mejlet säger om kvällen eller serien. */
function mailFields(group: AnnounceGroup, appUrl: string) {
  const first = group.first;
  return {
    eventTitle: first.title || "Nytt event",
    eventDate: first.event_date ? new Date(first.event_date) : undefined,
    location: first.event_location || undefined,
    eventUrl: announcementUrl(group, appUrl),
    occurrenceCount: group.count,
  };
}

/**
 * Mejlar de som följer utan konto. Hoppar över adresser som redan fått
 * kvällen som kontoföljare, så ingen får samma mejl två gånger. Varje mejl
 * bär sin egen avslutalänk.
 */
async function notifyEmailFollowers(opts: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  followedId: string;
  skipEmails: Set<string>;
  creatorName: string;
  group: AnnounceGroup;
  appUrl: string;
}): Promise<number> {
  const { admin, followedId, skipEmails, creatorName, group, appUrl } = opts;
  let sent = 0;
  for (const ef of await activeEmailFollowers(admin, followedId)) {
    if (skipEmails.has(ef.email)) continue;
    try {
      await sendCreatorEventEmail({
        to: ef.email,
        followerName: "",
        creatorName,
        ...mailFields(group, appUrl),
        followerId: null,
        unsubscribeUrl: `${appUrl}/folj/avsluta/${ef.unsubscribe_token}`,
        preferredLocale: ef.locale,
      });
      sent++;
    } catch (err) {
      console.error(`Email follower notify failed for ${ef.email}:`, err);
    }
  }
  return sent;
}
