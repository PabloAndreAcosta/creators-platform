import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../event-form";
import { createEvent } from "../actions";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <EventForm action={createEvent} userId={user.id} />;
}
