"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { sendVenueResponseEmail } from "@/lib/email/send-venue-response";
import { venueResponseState, shouldNotifyOrganiser } from "@/lib/venues/venue-response";

/**
 * Lokalens ja eller nej till att ett evenemang kopplas till den.
 *
 * Skrivningen går via RPC:n confirm_venue_listing och inte via en UPDATE, av en
 * anledning värd att komma ihåg: lokalen äger inte evenemanget. En RLS-policy
 * bred nog att låta lokalen bekräfta hade också låtit den ändra pris och titel
 * på någon annans arrangemang. Funktionen rör bara svarskolumnerna, och bara på
 * rader där lokalen är den utpekade.
 *
 * Efter svaret får arrangören en notis och ett mejl, både vid ja och nej. Förr
 * hände ingenting, och ett nej syntes inte alls för arrangören.
 */
export async function respondToVenueRequest(listingId: string, confirm: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const admin = createAdminClient();
  // Läget före svaret, så att arrangören bara får besked när något ändrades.
  const { data: before } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, venue_profile_id, venue_confirmed_at, venue_declined_at")
    .eq("id", listingId)
    .maybeSingle();

  const { error } = await supabase.rpc("confirm_venue_listing", {
    p_listing: listingId,
    p_confirm: confirm,
  });

  if (error) return { error: error.message };

  // RPC:n har redan prövat att den inloggade får svara för lokalen.
  if (before && before.user_id !== before.venue_profile_id && shouldNotifyOrganiser(venueResponseState(before), confirm)) {
    try {
      await notifyOrganiser(admin, before, confirm);
    } catch (e) {
      // Svaret är sparat. Ett fel i notisen får inte se ut som att det inte är det.
      console.error("[venue-requests] notify organiser:", e);
    }
  }

  revalidatePath("/app/venue-requests");
  return {};
}

async function notifyOrganiser(
  admin: ReturnType<typeof createAdminClient>,
  listing: { id: string; user_id: string; title: string | null; event_date: string | null; venue_profile_id: string | null },
  confirm: boolean
) {
  const [{ data: venue }, { data: organiser }] = await Promise.all([
    admin.from("profiles").select("full_name, company_name").eq("id", listing.venue_profile_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", listing.user_id).maybeSingle(),
  ]);
  // Namnet arrangören ser på lokalens publika sida går före bolagsnamnet.
  const venueName = (venue?.full_name || venue?.company_name || "").trim() || "Lokalen";
  const eventTitle = listing.title || "";
  const link = `/app/events/${listing.id}/edit`;

  await createNotification({
    userId: listing.user_id,
    type: confirm ? "venue_confirmed" : "venue_declined",
    titleKey: confirm ? "venueConfirmedTitle" : "venueDeclinedTitle",
    bodyKey: confirm ? "venueConfirmedMsg" : "venueDeclinedMsg",
    params: { venue: venueName, event: eventTitle },
    link,
  });

  if (organiser?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
    await sendVenueResponseEmail({
      to: organiser.email,
      organiserId: listing.user_id,
      organiserName: organiser.full_name,
      venueName,
      eventTitle,
      eventDate: listing.event_date ? new Date(listing.event_date) : undefined,
      confirmed: confirm,
      eventUrl: `${appUrl}${link}`,
    });
  }
}
