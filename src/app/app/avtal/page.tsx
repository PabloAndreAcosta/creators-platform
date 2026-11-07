import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { FileSignature, Lock, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteAgreements, type AgreementRow, type AgreementStatus } from "@/lib/agreements/model";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("agreements");
  return { title: `${t("title")} – Usha Platform` };
}

const STATUS_STYLE: Record<AgreementStatus, string> = {
  draft: "border-[var(--usha-border)] text-[var(--usha-muted)]",
  sent: "border-[var(--usha-gold)]/60 text-[var(--usha-gold)]",
  signed: "border-green-500/60 text-green-400",
  declined: "border-red-500/60 text-red-400",
  withdrawn: "border-[var(--usha-border)] text-[var(--usha-muted)]",
};

/**
 * Avtal — hubben under Mer. Lista över allt jag skrivit eller fått, och
 * knappen för nytt. Premium-funktion: andra ser knappen gråmarkerad med lås
 * (men kan fortfarande läsa och signera avtal de fått).
 */
export default async function AgreementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/avtal");
  const t = await getTranslations("agreements");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "sv-SE";

  const admin = createAdminClient();
  const [{ data: rows }, canWrite] = await Promise.all([
    admin
      .from("agreements")
      .select("id, created_by, counterparty_id, title, status, updated_at, sent_at, counterparty_signed_at")
      .or(`created_by.eq.${user.id},counterparty_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(100),
    canWriteAgreements(admin, user.id),
  ]);
  const list = (rows ?? []) as Pick<AgreementRow, "id" | "created_by" | "counterparty_id" | "title" | "status" | "updated_at">[];
  const otherIds = [...new Set(list.map((a) => (a.created_by === user.id ? a.counterparty_id : a.created_by)))];
  const names = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: ps } = await admin.from("profiles").select("id, full_name").in("id", otherIds);
    for (const p of ps ?? []) names.set(p.id, p.full_name || "—");
  }
  const waitingForMe = list.filter((a) => a.status === "sent" && a.counterparty_id === user.id).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-2 flex items-center gap-2">
        <FileSignature size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="ml-auto rounded-full border border-[var(--usha-gold)]/50 px-2.5 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">Premium</span>
      </div>
      <p className="mb-6 text-sm text-[var(--usha-muted)]">{t("lead")}</p>

      {canWrite ? (
        <Link href="/app/avtal/ny" className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-[var(--usha-gold)] py-3.5 text-base font-bold text-black transition hover:opacity-90">
          <Plus size={18} /> {t("new")}
        </Link>
      ) : (
        <Link href="/dashboard/billing" className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3.5 text-base font-medium text-[var(--usha-muted)] opacity-70">
          <Lock size={16} /> {t("newLocked")}
        </Link>
      )}

      {waitingForMe > 0 && <p className="mb-3 text-sm text-[var(--usha-gold)]">{t("waitingForMe", { n: waitingForMe })}</p>}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-sm text-[var(--usha-muted)]">{t("empty")}</div>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => {
            const mine = a.created_by === user.id;
            return (
              <li key={a.id}>
                <Link href={`/app/avtal/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {mine ? t("withParty", { name: names.get(a.counterparty_id) ?? "—" }) : t("fromParty", { name: names.get(a.created_by) ?? "—" })}
                      {" · "}
                      {new Date(a.updated_at).toLocaleDateString(dateFmt, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}>{t(`status_${a.status}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-10 space-y-2 text-sm text-[var(--usha-muted)]">
        <h2 className="text-xs font-semibold uppercase tracking-wide">{t("howHeading")}</h2>
        <p>{t("how1")}</p>
        <p>{t("how2")}</p>
        <p>{t("how3")}</p>
      </section>
    </div>
  );
}
