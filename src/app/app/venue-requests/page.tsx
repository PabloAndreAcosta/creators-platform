import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import VenueRequestsContent from "./venue-requests-content";

/**
 * Förfrågningar om att koppla ett evenemang till den här lokalen.
 *
 * Kopplingen ger arrangören plats på lokalens profilsida och utlöser mejl till
 * lokalens följare. Det är för mycket att ge bort automatiskt, så inget händer
 * förrän lokalen sagt ja här.
 */
export default async function VenueRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("listings")
    .select("id, title, event_date, event_time, event_location, venue_confirmed_at, profiles!user_id(full_name)")
    .eq("venue_profile_id", user.id)
    .neq("user_id", user.id)
    .eq("is_active", true)
    .order("event_date", { ascending: true });

  const t = await getTranslations("venueRequests");

  const items = (rows ?? []).map((r) => {
    const organiser = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      title: r.title ?? "",
      eventDate: r.event_date,
      eventTime: r.event_time ? String(r.event_time).slice(0, 5) : null,
      location: r.event_location,
      organiser: organiser?.full_name ?? null,
      // Översätts HÄR, på servern. Att skicka en funktion som gör det åt
      // klienten går inte: React kan inte serialisera funktioner över gränsen
      // mellan server- och klientkomponent, och sidan svarade 500 på varje
      // besök. Den var trasig från dag ett och syntes inte, eftersom ingen
      // lokal hade någon förfrågan att visa.
      byLabel: organiser?.full_name ? t("by", { name: organiser.full_name }) : null,
      confirmed: !!r.venue_confirmed_at,
    };
  });

  return (
    <VenueRequestsContent
      items={items}
      labels={{
        heading: t("heading"),
        intro: t("intro"),
        empty: t("empty"),
        pending: t("pending"),
        confirmed: t("confirmed"),
        approve: t("approve"),
        decline: t("decline"),
        withdraw: t("withdraw"),
        failed: t("failed"),
      }}
    />
  );
}
