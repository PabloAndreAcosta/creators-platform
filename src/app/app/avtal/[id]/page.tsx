import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ChevronLeft, CheckCircle2, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSign, canWriteAgreements, isParty, loadParties, logEvent, signatureName, type AgreementRow } from "@/lib/agreements/model";
import { AgreementActions } from "@/components/agreements/agreement-actions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ett avtal: texten, parterna, signaturerna och knapparna. Båda parter ser
 * samma sida; vad man kan göra styrs av status och roll i AgreementActions.
 */
export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/avtal/${id}`)}`);
  const t = await getTranslations("agreements");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "sv-SE";
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(dateFmt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

  const admin = createAdminClient();
  const { data } = await admin.from("agreements").select("*").eq("id", id).maybeSingle();
  const a = data as AgreementRow | null;
  if (!a || !isParty(a, user.id)) notFound();

  const isCreator = a.created_by === user.id;
  const [{ creator, counterparty }, canSend] = await Promise.all([
    loadParties(admin, a),
    isCreator ? canWriteAgreements(admin, user.id) : Promise.resolve(false),
  ]);
  const me = isCreator ? creator : counterparty;
  // Motpartens första visning loggas — det är en del av bevisen.
  if (!isCreator && a.status === "sent") void logEvent(admin, a.id, user.id, "viewed");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/app/avtal" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
        <ChevronLeft size={16} /> {t("title")}
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--usha-gold)]/50 px-2.5 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">{t(`status_${a.status}`)}</span>
        <span className="text-xs text-[var(--usha-muted)]">{t(`template_${a.template_key}`)}</span>
      </div>

      <article className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 sm:p-7">
        <h1 className="text-2xl font-bold">{a.title}</h1>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          {t("between", { a: signatureName(creator) || creator?.full_name || "—", b: signatureName(counterparty) || counterparty?.full_name || "—" })}
        </p>
        <pre className="mt-5 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-[var(--usha-white)]">{a.body}</pre>

        <div className="mt-8 grid gap-3 border-t border-[var(--usha-border)] pt-5 sm:grid-cols-2">
          <Signature label={t("partyA")} name={a.creator_sign_name ?? signatureName(creator) ?? ""} at={fmt(a.creator_signed_at)} signed={!!a.creator_signed_at} pendingText={t("notSigned")} signedText={t("signedAt")} />
          <Signature label={t("partyB")} name={a.counterparty_sign_name ?? signatureName(counterparty) ?? ""} at={fmt(a.counterparty_signed_at)} signed={!!a.counterparty_signed_at} pendingText={a.status === "declined" ? t("declinedAt", { at: fmt(a.declined_at) }) : a.status === "withdrawn" ? t("withdrawnAt", { at: fmt(a.withdrawn_at) }) : t("notSigned")} signedText={t("signedAt")} />
        </div>
        {a.status === "declined" && a.decline_reason && <p className="mt-3 text-sm text-[var(--usha-muted)]">{t("declineReason", { reason: a.decline_reason })}</p>}
        {a.content_hash && <p className="mt-4 break-all font-mono text-[10px] text-[var(--usha-muted)]/70">{t("hashLabel")}: {a.content_hash}</p>}
      </article>

      <div className="mt-5">
        <AgreementActions id={a.id} status={a.status} isCreator={isCreator} canSign={canSign(me)} canSend={canSend} title={a.title} body={a.body} />
      </div>

      <p className="mt-8 text-xs text-[var(--usha-muted)]">{t("legalNote")}</p>
    </div>
  );
}

function Signature({ label, name, at, signed, pendingText, signedText }: { label: string; name: string; at: string; signed: boolean; pendingText: string; signedText: string }) {
  return (
    <div className="rounded-xl border border-[var(--usha-border)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{label}</p>
      <p className="mt-1 font-semibold">{name || "—"}</p>
      <p className={`mt-1 flex items-center gap-1 text-xs ${signed ? "text-green-400" : "text-[var(--usha-muted)]"}`}>
        {signed ? <CheckCircle2 size={12} /> : <Clock size={12} />}
        {signed ? `${signedText} ${at}` : pendingText}
      </p>
    </div>
  );
}
