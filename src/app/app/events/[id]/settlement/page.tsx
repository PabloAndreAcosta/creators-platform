import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";

// Organizer settlement / payout report for one event. Read-only: it reconciles
// gross ticket sales against Usha's fee and refunds to show the net the
// organizer receives (before Stripe's own processing fee, which Stripe deducts
// directly). All figures are derived from our own bookings.
export default async function SettlementPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!listing) notFound();

  const { data: owner } = await supabase
    .from("profiles")
    .select("tier, creator_subcategory")
    .eq("id", user.id)
    .maybeSingle();
  const commissionRate = getCreatorCommissionRate(owner?.tier ?? "gratis", owner?.creator_subcategory);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("status, amount_paid, platform_fee_amount, refund_amount, guest_count")
    .eq("listing_id", listing.id)
    .eq("booking_type", "ticket");

  let ticketsSold = 0;
  let grossOre = 0;
  let platformFeeOre = 0;
  let refundedOre = 0;
  let refundedCount = 0;

  for (const b of bookings ?? []) {
    const qty = b.guest_count ?? 1;
    const paid = b.amount_paid ?? 0;
    if (b.status === "confirmed" || b.status === "completed") {
      ticketsSold += qty;
      grossOre += paid;
      // Prefer the persisted fee; fall back to a commission estimate for
      // bookings created before it was recorded.
      platformFeeOre += b.platform_fee_amount ?? Math.round(paid * commissionRate);
    } else if (b.status === "canceled" && b.refund_amount) {
      refundedOre += b.refund_amount;
      refundedCount += 1;
    }
  }

  const netOre = grossOre - platformFeeOre - refundedOre;
  const kr = (ore: number) => (ore / 100).toLocaleString("sv-SE", { maximumFractionDigits: 0 });

  const t = await getTranslations("settlement");
  const rows: { label: string; value: string; sub?: string; strong?: boolean; negative?: boolean }[] = [
    { label: t("grossLabel"), value: `${kr(grossOre)} kr`, sub: t("grossSub", { count: ticketsSold }) },
    { label: t("feeLabel"), value: `−${kr(platformFeeOre)} kr`, sub: t("feeSub"), negative: true },
    { label: t("refundedLabel"), value: `−${kr(refundedOre)} kr`, sub: refundedCount ? t("refundedSub", { count: refundedCount }) : t("refundedNone"), negative: true },
    { label: t("netLabel"), value: `${kr(netOre)} kr`, sub: t("netSub"), strong: true },
  ];

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-lg px-4 py-6">
        <Link
          href={`/app/events/${listing.id}/edit`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>

        <div className="mb-6 flex items-center gap-2">
          <Receipt size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-xl font-bold">{t("heading")}</h1>
        </div>
        <p className="mb-6 text-sm text-[var(--usha-muted)]">{listing.title}</p>

        <div className="divide-y divide-[var(--usha-border)] overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className={`text-sm ${r.strong ? "font-semibold text-[var(--usha-white)]" : "text-[var(--usha-muted)]"}`}>
                  {r.label}
                </p>
                {r.sub && <p className="text-xs text-[var(--usha-muted)]">{r.sub}</p>}
              </div>
              <p
                className={`text-sm tabular-nums ${
                  r.strong
                    ? "text-lg font-bold text-[var(--usha-gold)]"
                    : r.negative
                      ? "text-red-400"
                      : "font-medium text-[var(--usha-white)]"
                }`}
              >
                {r.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--usha-muted)]">{t("footer")}</p>
      </div>
    </main>
  );
}
