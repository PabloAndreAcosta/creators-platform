import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Calendar, MapPin, Users } from "lucide-react";

export default async function GigsDashboardPage() {
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

  const role = (profile as { role?: string | null } | null)?.role ?? null;
  if (role !== "venue") {
    redirect("/dashboard");
  }

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, title, event_date, event_time, venue, proposed_price, status, created_at")
    .eq("arranger_id", user.id)
    .order("event_date", { ascending: true });

  const gigIds = (gigs ?? []).map((g) => g.id);
  const { data: applications } =
    gigIds.length > 0
      ? await supabase
          .from("gig_applications")
          .select("id, gig_id, status")
          .in("gig_id", gigIds)
      : { data: [] };

  const appCountByGig: Record<string, { pending: number; total: number }> = {};
  (applications ?? []).forEach((a) => {
    const e = appCountByGig[a.gig_id] ?? { pending: 0, total: 0 };
    e.total += 1;
    if (a.status === "pending") e.pending += 1;
    appCountByGig[a.gig_id] = e;
  });

  const STATUS_LABELS: Record<string, { text: string; className: string }> = {
    open: { text: "Öppet", className: "bg-green-500/10 text-green-400" },
    filled: { text: "Tillsatt", className: "bg-blue-500/10 text-blue-400" },
    closed: { text: "Stängt", className: "bg-[var(--usha-border)] text-[var(--usha-muted)]" },
    canceled: { text: "Avbokat", className: "bg-red-500/10 text-red-400" },
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
          >
            <ArrowLeft size={14} />
            Tillbaka
          </Link>
          <h1 className="text-3xl font-bold">Gigs</h1>
          <p className="mt-1 text-[var(--usha-muted)]">
            Posta event och låt taxidansare ansöka.
          </p>
        </div>
        <Link
          href="/dashboard/gigs/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
        >
          <Plus size={14} />
          Nytt gig
        </Link>
      </div>

      {!gigs || gigs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-12 text-center">
          <p className="text-sm text-[var(--usha-muted)]">
            Du har inga gigs än. Skapa ett första för att börja samla ansökningar från taxidansare.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gigs.map((g) => {
            const counts = appCountByGig[g.id] ?? { pending: 0, total: 0 };
            const status = STATUS_LABELS[g.status] ?? STATUS_LABELS.open;
            return (
              <Link
                key={g.id}
                href={`/dashboard/gigs/${g.id}`}
                className="block rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition hover:border-[var(--usha-gold)]/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{g.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                      {counts.pending > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
                          <Users size={10} />
                          {counts.pending} {counts.pending === 1 ? "väntande ansökan" : "väntande ansökningar"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
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
                      <span className="text-[var(--usha-gold)]">{g.proposed_price} SEK</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
