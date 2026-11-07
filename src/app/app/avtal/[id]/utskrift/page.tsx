import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isParty, loadParties, signatureName, type AgreementRow } from "@/lib/agreements/model";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Utskriftsvy: svart text på vitt, inget annat. Appens menyer göms vid
 * utskrift med en print-regel, så sidan kan ligga kvar under /app där
 * inloggningen redan sköts.
 */
export default async function AgreementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/avtal/${id}/utskrift`)}`);
  const t = await getTranslations("agreements");

  const admin = createAdminClient();
  const { data } = await admin.from("agreements").select("*").eq("id", id).maybeSingle();
  const a = data as AgreementRow | null;
  if (!a || !isParty(a, user.id)) notFound();
  const { creator, counterparty } = await loadParties(admin, a);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="mx-auto max-w-2xl bg-white px-8 py-10 text-black print:max-w-none print:px-0">
      <style>{`@media print { nav, header, aside, footer, [data-print-hide] { display: none !important; } body { background: #fff !important; } }`}</style>
      <p className="text-xs uppercase tracking-wide text-neutral-500">Usha Platform · {t("title")}</p>
      <h1 className="mt-2 text-2xl font-bold">{a.title}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t("between", { a: signatureName(creator) || "—", b: signatureName(counterparty) || "—" })}</p>
      <pre className="mt-6 whitespace-pre-wrap font-sans text-[14px] leading-relaxed">{a.body}</pre>

      <div className="mt-10 grid grid-cols-2 gap-6 border-t border-neutral-300 pt-6 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("partyA")}</p>
          <p className="mt-1 font-semibold">{a.creator_sign_name || "—"}</p>
          <p className="text-neutral-600">{t("signedAt")} {fmt(a.creator_signed_at)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("partyB")}</p>
          <p className="mt-1 font-semibold">{a.counterparty_sign_name || "—"}</p>
          <p className="text-neutral-600">{t("signedAt")} {fmt(a.counterparty_signed_at)}</p>
        </div>
      </div>
      <p className="mt-6 text-[10px] text-neutral-500">{t("legalNote")}</p>
      {a.content_hash && <p className="mt-1 break-all font-mono text-[9px] text-neutral-400">{t("hashLabel")}: {a.content_hash} · ID {a.id}</p>}
      <p data-print-hide className="mt-8 text-sm text-neutral-500">{t("printHint")}</p>
    </div>
  );
}
