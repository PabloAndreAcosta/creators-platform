import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, MapPin, Briefcase } from "lucide-react";
import { ApplyToGigButton } from "./apply-button";

export default async function GigsFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, creator_subcategory")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string | null } | null)?.role ?? null;
  const subcategory = (profile as { creator_subcategory?: string | null } | null)?.creator_subcategory ?? null;
  const canApply = role === "creator" && subcategory === "taxi_dancer";

  const today = new Date().toISOString().slice(0, 10);
  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, arranger_id, title, description, event_date, event_time, venue, venue_address, proposed_price, perks, created_at")
    .eq("status", "open")
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  // Build a set of gig_ids the user has already applied to (only for taxi_dancers)
  let appliedGigIds = new Set<string>();
  if (canApply && gigs && gigs.length > 0) {
    const { data: myApps } = await supabase
      .from("gig_applications")
      .select("gig_id, status")
      .eq("applicant_id", user.id)
      .in("gig_id", gigs.map((g) => g.id));
    appliedGigIds = new Set(
      (myApps ?? [])
        .filter((a) => a.status === "pending" || a.status === "accepted")
        .map((a) => a.gig_id)
    );
  }

  const arrangerIds = Array.from(new Set((gigs ?? []).map((g) => g.arranger_id)));
  const { data: arrangers } =
    arrangerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", arrangerIds)
      : { data: [] };
  const arrangerMap = Object.fromEntries((arrangers ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Briefcase size={22} className="text-[var(--usha-gold)]" />
          Gigs
        </h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Eventförfrågningar från arrangörer som söker taxidansare. Ansök med ett kort meddelande.
        </p>
      </div>

      {!canApply && (
        <div className="mb-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm text-[var(--usha-muted)]">
          Endast taxidansare kan ansöka till gigs. <Link href="/taxidansare" className="text-[var(--usha-gold)] hover:underline">Läs mer</Link>.
        </div>
      )}

      {!gigs || gigs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-12 text-center text-sm text-[var(--usha-muted)]">
          Inga öppna gigs just nu. Kolla tillbaka snart.
        </div>
      ) : (
        <div className="space-y-3">
          {gigs.map((g) => {
            const alreadyApplied = appliedGigIds.has(g.id);
            return (
              <div key={g.id} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{g.title}</h2>
                    <p className="mt-0.5 text-xs text-[var(--usha-muted)]">
                      {arrangerMap[g.arranger_id] || "Arrangör"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {g.event_date}
                        {g.event_time ? ` ${g.event_time.slice(0, 5)}` : ""}
                      </span>
                      {g.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {g.venue}
                        </span>
                      )}
                      <span className="font-semibold text-[var(--usha-gold)]">{g.proposed_price} SEK</span>
                    </div>
                    {g.description && (
                      <p className="mt-3 text-sm text-[var(--usha-muted)] whitespace-pre-line">{g.description}</p>
                    )}
                    {g.perks && (
                      <p className="mt-2 text-xs text-[var(--usha-accent)]">Förmåner: {g.perks}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canApply && !alreadyApplied && <ApplyToGigButton gigId={g.id} />}
                    {canApply && alreadyApplied && (
                      <span className="rounded-lg bg-[var(--usha-gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)]">
                        Ansökt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
