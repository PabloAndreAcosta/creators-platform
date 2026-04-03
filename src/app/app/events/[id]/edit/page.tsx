import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventForm from "../../event-form";
import { updateEvent } from "../../actions";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("listings")
    .select("id, title, description, category, price, duration_minutes, event_tier, image_url, event_date, event_time, event_location, event_lat, event_lng, event_place_id, listing_type, min_guests, max_guests, experience_details")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!event) notFound();

  const action = updateEvent.bind(null, event.id);

  return <EventForm event={event} action={action} userId={user.id} />;
}
