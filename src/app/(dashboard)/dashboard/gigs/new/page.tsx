import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canPostGigs } from "@/lib/gigs/can-post";
import { getTranslations } from "next-intl/server";
import { createGig } from "../actions";
import { GigForm, type OwnEvent } from "./gig-form";
import { isCancelled } from "@/lib/entrance/door-link";

export default async function NewGigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!canPostGigs((profile as { role?: string | null } | null)?.role)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("gigForm");

  // Egna kommande kvällar, så att ett pass kan hängas på en av dem i stället för
  // att datum, tid och lokal skrivs in för hand. Inställda kvällar hoppas över.
  const today = new Date().toISOString().slice(0, 10);
  const { data: ownListings } = await supabase
    .from("listings")
    .select("id, title, event_date, event_time, event_venue, event_location, series_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("event_date", "is", null)
    .gte("event_date", today)
    .order("event_date", { ascending: true });
  const events: OwnEvent[] = (ownListings ?? [])
    .filter((l) => !isCancelled(l.title))
    .map((l) => ({
      id: l.id,
      title: l.title,
      date: String(l.event_date).slice(0, 10),
      time: l.event_time ? String(l.event_time).slice(0, 5) : null,
      venue: l.event_venue ?? null,
      address: l.event_location ?? null,
      seriesId: l.series_id ?? null,
    }));

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/gigs"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("pageIntro")}</p>
      </div>

      <GigForm action={createGig} events={events} />
    </>
  );
}
