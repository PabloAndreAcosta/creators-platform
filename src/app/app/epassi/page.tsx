import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HeartPulse, Check, X } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmEpassiPass, rejectEpassiPass } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Epassi-köp att bekräfta.
 *
 * Kunden har valt "Betala med friskvårdsbidrag" på ett klippkort och betalat
 * i Epassi-appen. Epassi har inget API, så arrangören jämför här mot Epassis
 * leverantörsportal (Betalningar → Dagens köp / Betalningshistorik) och
 * bekräftar. Först då blir klippkortet giltigt i dörren.
 *
 * Nås från notisen som skickas när en kund väljer Epassi.
 */

type Row = {
  id: string;
  status: string;
  created_at: string;
  amount_paid: number | null;
  customer_id: string;
  listings: { title: string; price: number | null } | { title: string; price: number | null }[] | null;
};

const SELECT = "id, status, created_at, amount_paid, customer_id, listings(title, price)";

function listingOf(r: Row) {
  return Array.isArray(r.listings) ? r.listings[0] ?? null : r.listings;
}

export default async function EpassiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/epassi");
  const t = await getTranslations("epassiAdmin");

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  const isAdmin = !!prof?.is_admin;

  const base = () => {
    const q = admin.from("bookings").select(SELECT).eq("payment_method", "epassi");
    return isAdmin ? q : q.eq("creator_id", user.id);
  };

  const [{ data: pending }, { data: recent }] = await Promise.all([
    base().eq("status", "pending").order("created_at", { ascending: true }).limit(50),
    base().neq("status", "pending").order("updated_at", { ascending: false }).limit(10),
  ]);

  // Kundens namn och e-post från profilen — det är dem arrangören jämför med
  // namnet på Epassi-köpet.
  const customerIds = Array.from(new Set([...(pending ?? []), ...(recent ?? [])].map((r) => (r as Row).customer_id)));
  const { data: people } = customerIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", customerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const person = new Map((people ?? []).map((p) => [p.id, p]));
  const nameOf = (r: Row) => person.get(r.customer_id)?.full_name || person.get(r.customer_id)?.email || "—";
  const emailOf = (r: Row) => (person.get(r.customer_id)?.full_name ? person.get(r.customer_id)?.email ?? null : null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("sv-SE", {
      timeZone: "Europe/Stockholm",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-2 flex items-center gap-2">
        <HeartPulse size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-xl font-bold">{t("title")}</h1>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-[var(--usha-muted)]">{t("intro")}</p>

      <h2 className="mb-3 text-sm font-semibold">{t("pendingHeading", { n: (pending ?? []).length })}</h2>
      {(pending ?? []).length === 0 ? (
        <p className="mb-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-sm text-[var(--usha-muted)]">
          {t("pendingEmpty")}
        </p>
      ) : (
        <ul className="mb-8 space-y-3">
          {(pending as Row[]).map((r) => {
            const l = listingOf(r);
            return (
              <li key={r.id} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
                <p className="font-semibold">{nameOf(r)}</p>
                {emailOf(r) && <p className="text-xs text-[var(--usha-muted)]">{emailOf(r)}</p>}
                <p className="mt-2 text-sm">
                  {l?.title ?? "—"}
                  {l?.price ? ` · ${l.price} kr` : ""}
                </p>
                <p className="text-xs text-[var(--usha-muted)]">{t("requestedAt", { when: fmt(r.created_at) })}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={confirmEpassiPass}>
                    <input type="hidden" name="bookingId" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--usha-gold)] px-3 py-2 text-sm font-semibold text-black"
                    >
                      <Check size={16} />
                      {t("confirm")}
                    </button>
                  </form>
                  <form action={rejectEpassiPass}>
                    <input type="hidden" name="bookingId" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-sm"
                    >
                      <X size={16} />
                      {t("reject")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(recent ?? []).length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold">{t("recentHeading")}</h2>
          <ul className="space-y-2">
            {(recent as Row[]).map((r) => {
              const l = listingOf(r);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {nameOf(r)} · {l?.title ?? "—"}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--usha-muted)]">
                    {r.status === "canceled" ? t("statusRejected") : t("statusConfirmed")}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
