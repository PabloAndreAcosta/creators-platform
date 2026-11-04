import { listVenueOptions } from "@/lib/venues/list";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageListing } from "@/lib/listings/manage-access";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Users, Radio, ScanLine, BarChart3, Receipt, Mail, Ticket, QrCode } from "lucide-react";
import EventForm from "../../event-form";
import { updateEvent } from "../../actions";
import { getTranslations } from "next-intl/server";

export default async function EditEventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const t = await getTranslations("myEvents");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Load via service role so a co-organizer (who doesn't own the row) can open
  // the editor, then authorize as owner OR accepted can_manage collaborator.
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("listings")
    .select("id, user_id, title, description, tldr, category, price, duration_minutes, event_tier, image_url, event_date, event_time, event_end_time, event_location, event_lat, event_lng, event_place_id, event_city, event_venue, venue_profile_id, venue_confirmed_at, listing_type, open_to_instructors, is_practica, is_public, content_language, early_bird_start, early_bird_end, early_bird_price, public_sale_at, capacity, min_guests, max_guests, experience_details")
    .eq("id", params.id)
    .single();

  if (!event) notFound();
  const isOwner = event.user_id === user.id;
  if (!isOwner && !(await canManageListing(admin, user.id, params.id))) notFound();

  // Existing ticket types (price tiers) so the editor can pre-fill them.
  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("id, name, price, capacity, ticket_type_pools(ticket_pools(name, capacity))")
    .eq("listing_id", event.id)
    .order("sort_order", { ascending: true });

  // Platta ut potten till fälten redigeraren använder.
  //
  // Taket sitter på potten och inte på raden, så radens egen capacity är null
  // för en pottmedlem. Skickas den tomma vidare skulle nästa sparning tolka det
  // som "ingen kapacitet" och radera potten — därför läses pottens tak tillbaka
  // in i fältet, precis som användaren skrev det.
  const ticketTypeRows = (ticketTypes ?? []).map((tt) => {
    // PostgREST typar nästlade embeds som arrayer även när relationen är
    // till-en, så båda formerna hanteras.
    type Pott = { name: string; capacity: number };
    const kopplingar = (tt.ticket_type_pools ?? []) as unknown as { ticket_pools: Pott | Pott[] | null }[];
    const potter = kopplingar
      .map((k) => (Array.isArray(k.ticket_pools) ? k.ticket_pools[0] : k.ticket_pools))
      .filter((p): p is Pott => !!p);
    return {
      id: tt.id,
      name: tt.name,
      price: tt.price,
      // Taket sitter på potten, så radens egen capacity är null. Läs tillbaka
      // pottens tak — men bara när raden tillhör EN pott, för då är talet
      // entydigt. En kombinationsbiljett har inget eget tak att visa.
      capacity: tt.capacity ?? (potter.length === 1 ? potter[0].capacity : null),
      pools: potter.map((p) => p.name),
    };
  });

  const venues = await listVenueOptions();

  const action = updateEvent.bind(null, event.id);

  return (
    <>
      {/* Dörren först: skanna och sälj i entrén är samma person i samma stund,
          så de får en egen rad. Resten är ett kompakt rutnät. Allt syns direkt;
          en länk som göms i en meny hittas inte. */}
      <div className="space-y-2 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/app/scan"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            <ScanLine size={16} className="shrink-0" />
            <span className="truncate">{t("scanTickets")}</span>
          </Link>
          <Link
            href={`/app/events/${event.id}/entre`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--usha-gold)]/60 px-3 py-2.5 text-sm font-medium text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/10"
          >
            <QrCode size={16} className="shrink-0" />
            <span className="truncate">{t("sellAtDoor")}</span>
          </Link>
        </div>
        <nav aria-label={t("eventToolsLabel")} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { href: "bookings", icon: Ticket, label: t("eventBookings") },
            { href: "live", icon: Radio, label: t("actionLive"), live: true },
            { href: "crew", icon: Users, label: t("crew") },
            { href: "waitlist", icon: Mail, label: t("actionWaitlist") },
            { href: "stats", icon: BarChart3, label: t("statistics") },
            { href: "settlement", icon: Receipt, label: t("actionSettlement") },
          ].map(({ href, icon: Icon, label, live }) => (
            <Link
              key={href}
              href={`/app/events/${event.id}/${href}`}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--usha-border)] px-1 py-2 text-center text-xs font-medium leading-tight text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
            >
              <Icon size={16} className={live ? "text-green-400" : "text-[var(--usha-muted)]"} />
              <span className="line-clamp-2 break-words">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <EventForm event={{ ...event, ticketTypes: ticketTypeRows }} action={action} userId={user.id} venues={venues} />
    </>
  );
}
