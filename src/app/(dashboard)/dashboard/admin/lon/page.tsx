import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminDestinationsFor } from "@/lib/navigation/registry";
import { payrollRouteLiveForAll, payrollPilotIds } from "@/lib/assignments/route";
import { loadPendingUnderlag } from "@/lib/assignments/load-underlag";
import { markSubmitted } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Admin: löneunderlaget till SAMekonomi.
 *
 * Uppdrag som kreatörer utan bolag genomfört och som betalats till Usha
 * samlas här, en rad per kreatör, med exakt de fält SAMekonomis
 * samlingsfaktura kräver. Fyll i deras fakturanummer när raden är inlagd —
 * då märks uppdragen som skickade och skickas aldrig igen.
 */
export default async function AdminPayrollPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const access = await requireAdmin("full");
  const t = await getTranslations("adminPayroll");
  const live = payrollRouteLiveForAll();
  const pilotCount = payrollPilotIds().length;
  const { rows, totalOre } = await loadPendingUnderlag();

  const { data: recent } = await createAdminClient()
    .from("payroll_shadow_lines")
    .select("id, pass_date, price_ore, labour_budget_ore, net_ore, sam_net_ore, live, sam_submitted_at, sam_reference, voided_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const kr = (ore: number) => `${(ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
  const notices: Record<string, string> = {
    submitted: t("noticeSubmitted"),
    missing: t("noticeMissing"),
    blocked: t("noticeBlocked"),
  };
  const statusOf = (r: NonNullable<typeof recent>[number]) =>
    r.voided_at ? t("statusVoided") : r.sam_submitted_at ? t("statusSubmitted", { ref: r.sam_reference ?? "" }) : r.live ? t("statusPending") : t("statusShadow");

  return (
    <>
      <AdminNav paths={adminDestinationsFor(access).map((d) => d.path)} />
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("intro")}</p>
      </div>

      <div
        className={`mb-6 rounded-xl border px-4 py-3 text-sm ${live ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 text-[var(--usha-muted)]"}`}
      >
        {live ? t("liveOn") : t("liveOff")}
        {!live && pilotCount > 0 && <p className="mt-1 font-medium">{t("pilotOn", { n: pilotCount })}</p>}
      </div>

      {notice && notices[notice] && (
        <div className="mb-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium">{notices[notice]}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("pendingTitle", { total: kr(totalOre) })}</h2>
        {rows.some((r) => !r.blocked && r.amountOre > 0) && (
          <a
            href="/dashboard/admin/lon/underlag"
            className="rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm font-medium hover:border-[var(--usha-gold)]/40"
          >
            {t("downloadCsv")}
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mb-8 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-sm text-[var(--usha-muted)]">
          {t("pendingEmpty")}
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {rows.map((r) => (
            <div key={r.creatorId} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
                <dt className="text-[var(--usha-muted)]">{t("fieldName")}</dt>
                <dd className="font-medium">{r.name}</dd>
                <dt className="text-[var(--usha-muted)]">{t("fieldPnr")}</dt>
                <dd className="font-mono">{r.personalNumber ?? <span className="text-red-400">{t("pnrMissing")}</span>}</dd>
                <dt className="text-[var(--usha-muted)]">{t("fieldTitle")}</dt>
                <dd>{r.title}</dd>
                <dt className="text-[var(--usha-muted)]">{t("fieldDescription")}</dt>
                <dd>{r.description}</dd>
                <dt className="text-[var(--usha-muted)]">{t("fieldAmount")}</dt>
                <dd className="font-semibold tabular-nums">
                  {kr(r.amountOre)}
                  {r.debtDeductedOre > 0 && (
                    <span className="ml-2 font-normal text-[var(--usha-muted)]">
                      {t("debtDeducted", { sum: kr(r.sumOre), debt: kr(r.debtDeductedOre) })}
                    </span>
                  )}
                </dd>
              </dl>
              {!r.blocked && r.amountOre > 0 && (
                <form action={markSubmitted} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="creatorId" value={r.creatorId} />
                  <input
                    name="reference"
                    required
                    placeholder={t("referencePlaceholder")}
                    className="w-56 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-1.5 text-sm outline-none focus:border-[var(--usha-gold)]/40"
                  />
                  <button className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-xs font-bold text-black">
                    {t("markSubmitted")}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">{t("recentTitle")}</h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--usha-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--usha-card)] text-left text-xs uppercase tracking-wider text-[var(--usha-muted)]">
            <tr>
              <th className="px-4 py-2">{t("colDate")}</th>
              <th className="px-4 py-2 text-right">{t("colPrice")}</th>
              <th className="px-4 py-2 text-right">{t("colBudget")}</th>
              <th className="px-4 py-2 text-right">{t("colNetSam")}</th>
              <th className="px-4 py-2 text-right">{t("colNetOwn")}</th>
              <th className="px-4 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-[var(--usha-muted)]" colSpan={6}>
                  {t("recentEmpty")}
                </td>
              </tr>
            )}
            {(recent ?? []).map((r) => (
              <tr key={r.id} className="border-t border-[var(--usha-border)]">
                <td className="px-4 py-2 whitespace-nowrap">{r.pass_date}</td>
                <td className="px-4 py-2 text-right tabular-nums">{kr(r.price_ore)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{kr(r.labour_budget_ore)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{kr(r.sam_net_ore)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{kr(r.net_ore)}</td>
                <td className="px-4 py-2">{statusOf(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
