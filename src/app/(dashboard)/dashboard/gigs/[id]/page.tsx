import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { GigApplicationActions } from "./application-actions";

export default async function GigDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gig } = await supabase
    .from("gigs")
    .select("id, arranger_id, title, description, event_date, event_time, venue, venue_address, proposed_price, perks, status, created_at")
    .eq("id", params.id)
    .single();

  if (!gig) notFound();
  if (gig.arranger_id !== user.id) redirect("/dashboard/gigs");

  const { data: applications } = await supabase
    .from("gig_applications")
    .select("id, applicant_id, message, status, created_at")
    .eq("gig_id", gig.id)
    .order("created_at", { ascending: false });

  const applicantIds = (applications ?? []).map((a) => a.applicant_id);
  const { data: applicants } =
    applicantIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, slug, avatar_url, dance_styles, dance_experience_years")
          .in("id", applicantIds)
      : { data: [] };

  const applicantMap = Object.fromEntries((applicants ?? []).map((p) => [p.id, p]));

  const STATUS_LABELS: Record<string, { text: string; className: string }> = {
    pending: { text: "Väntande", className: "bg-yellow-500/10 text-yellow-400" },
    accepted: { text: "Accepterad", className: "bg-green-500/10 text-green-400" },
    declined: { text: "Avböjd", className: "bg-[var(--usha-border)] text-[var(--usha-muted)]" },
    withdrawn: { text: "Tillbakadragen", className: "bg-[var(--usha-border)] text-[var(--usha-muted)]" },
  };

  return (
    <>
      <div className="mb-6">
        <Link href="/dashboard/gigs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white">
          <ArrowLeft size={14} />
          Alla gigs
        </Link>
        <h1 className="text-3xl font-bold">{gig.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {gig.event_date}
            {gig.event_time ? ` ${gig.event_time.slice(0, 5)}` : ""}
          </span>
          {gig.venue && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {gig.venue}
            </span>
          )}
          <span className="text-[var(--usha-gold)]">{gig.proposed_price} SEK</span>
        </div>
        {gig.description && (
          <p className="mt-4 text-sm text-[var(--usha-muted)] whitespace-pre-line">{gig.description}</p>
        )}
        {gig.perks && (
          <p className="mt-2 text-sm text-[var(--usha-accent)]">Förmåner: {gig.perks}</p>
        )}
      </div>

      <h2 className="mb-4 text-lg font-bold">Ansökningar ({applications?.length ?? 0})</h2>
      {!applications || applications.length === 0 ? (
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center text-sm text-[var(--usha-muted)]">
          Inga ansökningar än.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => {
            const applicant = applicantMap[a.applicant_id];
            const status = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
            const styles = (applicant as { dance_styles?: string[] | null } | null)?.dance_styles ?? [];
            const years = (applicant as { dance_experience_years?: number | null } | null)?.dance_experience_years ?? null;
            return (
              <div key={a.id} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/creators/${applicant?.slug || a.applicant_id}`}
                        className="font-semibold hover:underline"
                      >
                        {applicant?.full_name || "Anonym taxidansare"}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                    </div>
                    {(styles.length > 0 || years != null) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--usha-muted)]">
                        {styles.length > 0 && <span>{styles.join(", ")}</span>}
                        {years != null && <span>· {years} års erfarenhet</span>}
                      </div>
                    )}
                    {a.message && (
                      <p className="mt-2 text-sm text-[var(--usha-muted)] italic">&ldquo;{a.message}&rdquo;</p>
                    )}
                  </div>
                  {a.status === "pending" && gig.status === "open" && (
                    <GigApplicationActions applicationId={a.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
