import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Users, Radio, ScanLine, BarChart3 } from "lucide-react";
import EventForm from "../../event-form";
import { updateEvent } from "../../actions";

export default async function EditEventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("listings")
    .select("id, title, description, category, price, duration_minutes, event_tier, image_url, event_date, event_time, event_end_time, event_location, event_lat, event_lng, event_place_id, event_city, event_venue, listing_type, open_to_instructors, is_public, min_guests, max_guests, experience_details")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!event) notFound();

  const action = updateEvent.bind(null, event.id);

  return (
    <>
      <div className="flex flex-wrap gap-2 px-4 pt-4">
        <Link
          href="/app/scan"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
        >
          <ScanLine size={15} />
          Skanna biljetter
        </Link>
        <Link
          href={`/app/events/${event.id}/crew`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
        >
          <Users size={15} />
          Crew
        </Link>
        <Link
          href={`/app/events/${event.id}/live`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium text-green-400 transition hover:border-green-400/60"
        >
          <Radio size={15} />
          Live Dashboard
        </Link>
        <Link
          href={`/app/events/${event.id}/stats`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
        >
          <BarChart3 size={15} />
          Statistik
        </Link>
      </div>
      <EventForm event={event} action={action} userId={user.id} />
    </>
  );
}
