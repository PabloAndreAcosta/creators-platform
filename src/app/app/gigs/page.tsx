import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadLinkedEvents } from "@/lib/gigs/linked-events";
import { GigEventLine } from "@/components/gigs/gig-event-line";
import Link from "next/link";
import { Calendar, MapPin, Briefcase } from "lucide-react";
import { ApplyToGigButton } from "./apply-button";
import { assignmentRoute } from "@/lib/assignments/route";
import { quoteAssignment, creatorReceivesOre } from "@/lib/assignments/quote";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function GigsFeedPage() {
  const t = await getTranslations("gigsPage");
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
  const canApply = role === "creator";

  // Egna bolagsfält och nivå avgör vad ett gig ger i handen. Bolagsfälten är
  // kolumnlåsta i profiles, så de läses med service-rollen — bara för en själv.
  const { data: own } = canApply
    ? await createAdminClient()
        .from("profiles")
        .select("tier, is_company, company_verified_at, is_usha_owned_seller")
        .eq("id", user.id)
        .single()
    : { data: null };
  const route = own
    ? assignmentRoute({
        is_company: own.is_company ?? null,
        company_verified_at: own.company_verified_at ?? null,
        is_usha_owned_seller: own.is_usha_owned_seller ?? null,
      })
    : null;
  const commissionRate = getCreatorCommissionRate(own?.tier ?? "gratis", subcategory);
  const kr = (ore: number) => Math.round(ore / 100).toLocaleString("sv-SE");

  const today = new Date().toISOString().slice(0, 10);
  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, arranger_id, title, description, event_date, event_time, venue, venue_address, proposed_price, perks, created_at, listing_id, pass_type")
    .eq("status", "open")
    .neq("arranger_id", user.id)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  // Build a set of gig_ids the user has already applied to
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
  const linkedEvents = await loadLinkedEvents(supabase, gigs ?? []);
  const tf = await getTranslations("gigForm");

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Briefcase size={22} className="text-[var(--usha-gold)]" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {t("subtitle")}
        </p>
      </div>

      {!canApply && (
        <div className="mb-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm text-[var(--usha-muted)]">
          {t("onlyCreators")}
        </div>
      )}

      {/* Lön nämns bara när det finns betalda uppdrag. Volontäruppdrag (0 kr)
          ska aldrig tala om anställning eller lönepartner. */}
      {canApply && route === "payroll" && (gigs ?? []).some((g) => g.proposed_price > 0) && (
        <div className="mb-6 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4 text-sm text-[var(--usha-muted)]">
          {t("payrollIntro")}
        </div>
      )}

      {!gigs || gigs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-12 text-center text-sm text-[var(--usha-muted)]">
          {t("emptyState")}
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
                    <GigEventLine passType={g.pass_type} event={g.listing_id ? linkedEvents[g.listing_id] : undefined} t={tf} />
                    <p className="mt-0.5 text-xs text-[var(--usha-muted)]">
                      {arrangerMap[g.arranger_id] || t("arranger")}
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
                      <span className="font-semibold text-[var(--usha-gold)]">{t("price", { price: g.proposed_price })}</span>
                    </div>
                    {g.description && (
                      <p className="mt-3 text-sm text-[var(--usha-muted)] whitespace-pre-line">{g.description}</p>
                    )}
                    {g.perks && (
                      <p className="mt-2 text-xs text-[var(--usha-accent)]">{t("perks", { perks: g.perks })}</p>
                    )}
                    {route && g.proposed_price === 0 && (
                      <p className="mt-2 text-xs text-[var(--usha-muted)]">{t("volunteerGig")}</p>
                    )}
                    {route && g.proposed_price > 0 && (() => {
                      const q = quoteAssignment({
                        priceKr: g.proposed_price,
                        route,
                        commissionRate,
                        // Lönen betalas dagen efter passet.
                        paidOn: g.event_date,
                      });
                      return (
                        <p className="mt-2 text-xs text-[var(--usha-muted)]">
                          {q.route === "payroll"
                            ? t("youGetPayroll", { net: kr(creatorReceivesOre(q)), gross: kr(q.wage.grossOre) })
                            : t("youGetCompany", { amount: kr(creatorReceivesOre(q)) })}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canApply && !alreadyApplied && <ApplyToGigButton gigId={g.id} />}
                    {canApply && alreadyApplied && (
                      <span className="rounded-lg bg-[var(--usha-gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)]">
                        {t("applied")}
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
