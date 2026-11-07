import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteAgreements, signatureName, PARTY_COLUMNS, type PartyProfile } from "@/lib/agreements/model";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/agreements/templates";
import { stockholmDay } from "@/lib/tickets/event-day";
import { NewAgreementForm } from "@/components/agreements/new-agreement-form";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nytt avtal. ?with=<userId> förväljer motparten (från crew-sidan),
 * ?listing=<id> kvällen. Mallarna översätts här och skickas till formuläret.
 */
export default async function NewAgreementPage({ searchParams }: { searchParams: Promise<{ with?: string; listing?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/avtal/ny");
  const t = await getTranslations("agreements");
  const { with: withId, listing: listingParam } = await searchParams;

  const admin = createAdminClient();
  const [canWrite, { data: me }, { data: listings }] = await Promise.all([
    canWriteAgreements(admin, user.id),
    admin.from("profiles").select(PARTY_COLUMNS).eq("id", user.id).maybeSingle(),
    admin
      .from("listings")
      .select("id, title, event_date, event_location")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .gte("event_date", stockholmDay(new Date()))
      .order("event_date", { ascending: true })
      .limit(40),
  ]);

  let preselected: { id: string; name: string; avatar: string | null; source: "crew" } | null = null;
  if (withId && UUID.test(withId) && withId !== user.id) {
    const { data: p } = await admin.from("profiles").select("id, full_name, avatar_url").eq("id", withId).maybeSingle();
    if (p) preselected = { id: p.id, name: p.full_name || "—", avatar: p.avatar_url, source: "crew" };
  }
  const preselectedListingId = listingParam && (listings ?? []).some((l) => l.id === listingParam) ? listingParam : null;

  const templates = Object.fromEntries(
    TEMPLATE_KEYS.map((k) => [k, { title: t(`templates.${k}.title`), body: t(`templates.${k}.body`) }])
  ) as Record<TemplateKey, { title: string; body: string }>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/app/avtal" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
        <ChevronLeft size={16} /> {t("title")}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t("new")}</h1>

      {!canWrite ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <Lock size={18} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
          <div>
            <p className="text-sm">{t("lockedBody")}</p>
            <Link href="/dashboard/billing" className="mt-2 inline-block text-sm font-semibold text-[var(--usha-gold)]">{t("upgrade")} →</Link>
          </div>
        </div>
      ) : (
        <NewAgreementForm
          myName={signatureName(me as PartyProfile | null) || (me as PartyProfile | null)?.full_name || ""}
          listings={listings ?? []}
          preselected={preselected}
          preselectedListingId={preselectedListingId}
          templates={templates}
        />
      )}
    </div>
  );
}
