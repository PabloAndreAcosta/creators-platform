import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { loadLinkedEvents } from "@/lib/gigs/linked-events";
import { GigEventLine } from "@/components/gigs/gig-event-line";
import { GigApplicationActions } from "./application-actions";
import { loadAssignmentRoutes } from "@/lib/assignments/load";

export default async function GigDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const t = await getTranslations("gigDetail");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gig } = await supabase
    .from("gigs")
    .select("id, arranger_id, title, description, event_date, event_time, event_end_time, venue, venue_address, proposed_price, perks, status, created_at, listing_id, pass_type")
    .eq("id", params.id)
    .single();

  if (!gig) notFound();
  if (gig.arranger_id !== user.id) redirect("/dashboard/gigs");
  const linkedEvents = await loadLinkedEvents(supabase, [gig]);
  const tf = await getTranslations("gigForm");

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
  // Giget är tittarens eget (kontrollerat ovan), så de sökandes väg får visas.
  const routes = await loadAssignmentRoutes(applicantIds);

  const STATUS_LABELS: Record<string, { text: string; className: string }> = {
    pending: { text: t("statusPending"), className: "bg-yellow-500/10 text-yellow-400" },
    accepted: { text: t("statusAccepted"), className: "bg-green-500/10 text-green-400" },
    declined: { text: t("statusDeclined"), className: "bg-[var(--usha-border)] text-[var(--usha-muted)]" },
    withdrawn: { text: t("statusWithdrawn"), className: "bg-[var(--usha-border)] text-[var(--usha-muted)]" },
  };

  return (
    <>
      <div className="mb-6">
        <Link href="/dashboard/gigs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]">
          <ArrowLeft size={14} />
          {t("backToGigs")}
        </Link>
        <h1 className="text-3xl font-bold">{gig.title}</h1>
        <GigEventLine passType={gig.pass_type} event={gig.listing_id ? linkedEvents[gig.listing_id] : undefined} t={tf} />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {gig.event_date}
            {gig.event_time ? ` ${gig.event_time.slice(0, 5)}${gig.event_end_time ? `–${gig.event_end_time.slice(0, 5)}` : ""}` : ""}
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
          <p className="mt-2 text-sm text-[var(--usha-accent)]">{t("perks", { perks: gig.perks })}</p>
        )}
      </div>

      <p className="mb-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm text-[var(--usha-muted)]">
        {gig.proposed_price > 0 ? t("employerNote") : t("volunteerNote")}
      </p>

      <h2 className="mb-4 text-lg font-bold">{t("applicationsCount", { count: applications?.length ?? 0 })}</h2>
      {!applications || applications.length === 0 ? (
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center text-sm text-[var(--usha-muted)]">
          {t("noApplications")}
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
                        {applicant?.full_name || t("anonymousDancer")}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                      {gig.proposed_price > 0 && routes.get(a.applicant_id) === "payroll" && (
                        <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
                          {t("routePayroll")}
                        </span>
                      )}
                      {gig.proposed_price > 0 && routes.get(a.applicant_id) === "own_company" && (
                        <span className="rounded-full bg-[var(--usha-border)] px-2 py-0.5 text-xs font-medium text-[var(--usha-muted)]">
                          {t("routeCompany")}
                        </span>
                      )}
                    </div>
                    {(styles.length > 0 || years != null) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--usha-muted)]">
                        {styles.length > 0 && <span>{styles.join(", ")}</span>}
                        {years != null && <span>· {t("yearsExperience", { years })}</span>}
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
