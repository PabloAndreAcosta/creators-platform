import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../event-form";
import { createEvent } from "../actions";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { from } = await searchParams;

  let prefill = undefined;
  if (from) {
    const { data } = await supabase
      .from("listings")
      .select("id, title, description, category, price, duration_minutes, event_tier, image_url, event_location, event_lat, event_lng, event_place_id, listing_type, open_to_instructors, min_guests, max_guests, experience_details")
      .eq("id", from)
      .eq("user_id", user.id)
      .single();
    if (data) {
      prefill = {
        ...data,
        id: "",
        event_date: null,
        event_time: null,
        event_end_time: null,
      };
    }
  }

  return <EventForm action={createEvent} userId={user.id} event={prefill} />;
}
