import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockholmToday } from "@/lib/time";
import {
  buildMonthlyStatement,
  previousPeriod,
  statementIsDue,
  type StatementPayout,
  type StatementSupplement,
} from "@/lib/settlements/monthly-statement";
import { sendSettlementStatementEmail } from "@/lib/email/send-settlement-statement";
import { swishPartnerShareOre, swishTotalsByListing } from "@/lib/settlements/swish";

/** Ushas ekonomilista — samma som övriga ekonomilarm, ägaren ingår. */
function internalRecipients(): string[] {
  const raw = process.env.PLATFORM_SALE_ALERT_TO || "pablo.acosta@usha.se";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Svar på avräkningen ska nå en människa, inte no-reply. */
const REPLY_TO = "pablo.acosta@usha.se";

function periodBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: `${period}-01`, to: next };
}

type ListingJoin = { event_date: string | null; title: string | null } | { event_date: string | null; title: string | null }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/**
 * Cron: förra månadens avräkning till varje partner, första vardagen i månaden.
 *
 * Körs varje morgon. Raden i settlement_statements gör det idempotent: partnern
 * får månaden en gång. Saknar partnern adress går underlaget bara till Ushas
 * ekonomilista (en gång), och skickas till partnern den dag en adress läggs in.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = stockholmToday();
  if (!statementIsDue(today)) {
    return NextResponse.json({ ok: true, skipped: "före första vardagen" });
  }

  const period = previousPeriod(today);
  const { from, to } = periodBounds(period);
  const db = createAdminClient();

  // Kvällar i perioden, och kompletteringar som betalats ut i perioden
  // (de senare kan gälla kvällar i tidigare månader).
  const [{ data: payoutRows, error: pErr }, { data: suppRows, error: sErr }] = await Promise.all([
    db
      .from("event_settlement_payouts")
      .select("listing_id, partner_profile_id, status, amount_ore, gross_ore, refunded_ore, vat_ore, basis_ore, partner_percent, vat_rate, stripe_transfer_id, paid_at, listing:listings!inner(event_date, title)")
      .gte("listing.event_date", from)
      .lt("listing.event_date", to),
    db
      .from("event_settlement_supplements")
      .select("listing_id, partner_profile_id, seq, status, amount_ore, due_ore, gross_ore, refunded_ore, vat_ore, basis_ore, stripe_transfer_id, paid_at, listing:listings(event_date, title)")
      .eq("status", "paid")
      // Ett dygns marginal åt båda håll: månadsgränsen gäller i svensk tid,
      // och buildMonthlyStatement sorterar sedan exakt på Stockholmsdatum.
      .gte("paid_at", new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString())
      .lt("paid_at", new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString()),
  ]);
  if (pErr || sErr) throw pErr ?? sErr;

  // Kompletteringar till månadens egna kvällar, oavsett när de betalades.
  const listingIds = [...new Set((payoutRows ?? []).map((p) => p.listing_id as string))];
  const { data: ownSupps } = listingIds.length
    ? await db
        .from("event_settlement_supplements")
        .select("listing_id, partner_profile_id, seq, status, amount_ore, due_ore, gross_ore, refunded_ore, vat_ore, basis_ore, stripe_transfer_id, paid_at, listing:listings(event_date, title)")
        .in("listing_id", listingIds)
    : { data: [] };

  const { data: bookingRows } = listingIds.length
    ? await db.from("bookings").select("listing_id").in("listing_id", listingIds).in("status", ["confirmed", "completed"])
    : { data: [] };
  const tickets = new Map<string, number>();
  for (const b of bookingRows ?? []) tickets.set(b.listing_id as string, (tickets.get(b.listing_id as string) ?? 0) + 1);

  const toSupp = (s: Record<string, unknown>): StatementSupplement & { partnerId: string } => {
    const l = one(s.listing as ListingJoin);
    return {
      partnerId: s.partner_profile_id as string,
      listingId: s.listing_id as string,
      eventDate: l?.event_date ?? "",
      title: l?.title ?? "",
      seq: s.seq as number,
      amountOre: s.amount_ore as number,
      dueOre: s.due_ore as number,
      grossOre: s.gross_ore as number,
      refundedOre: s.refunded_ore as number,
      vatOre: s.vat_ore as number,
      basisOre: s.basis_ore as number,
      status: s.status as string,
      paidAt: (s.paid_at as string | null) ?? null,
      transferId: (s.stripe_transfer_id as string | null) ?? null,
    };
  };
  const supps = new Map<string, StatementSupplement & { partnerId: string }>();
  for (const s of [...(suppRows ?? []), ...(ownSupps ?? [])]) {
    const x = toSupp(s as Record<string, unknown>);
    supps.set(`${x.listingId}:${x.seq}`, x);
  }

  const payouts: (StatementPayout & { partnerId: string })[] = (payoutRows ?? []).map((p) => {
    const l = one(p.listing as ListingJoin);
    return {
      partnerId: p.partner_profile_id as string,
      listingId: p.listing_id as string,
      eventDate: l?.event_date ?? "",
      title: l?.title ?? "",
      tickets: tickets.get(p.listing_id as string) ?? 0,
      grossOre: p.gross_ore as number,
      refundedOre: p.refunded_ore as number,
      vatOre: p.vat_ore as number,
      basisOre: p.basis_ore as number,
      vatRate: Number(p.vat_rate),
      partnerPercent: Number(p.partner_percent),
      amountOre: p.amount_ore as number,
      status: p.status as string,
      paidAt: (p.paid_at as string | null) ?? null,
      transferId: (p.stripe_transfer_id as string | null) ?? null,
    };
  });

  // Swish-försäljningen ligger utanför Stripe och därmed utanför payout-
  // raderna. Den räknas fram här, kväll för kväll, och läggs på raden —
  // partnerns andel av den betalas via bank, inte via överföringen.
  const { data: swishListings } = await db
    .from("bookings")
    .select("listing_id, listing:listings!inner(event_date, title, id)")
    .eq("booking_type", "ticket")
    .eq("payment_method", "swish")
    .gte("listing.event_date", from)
    .lt("listing.event_date", to);
  const swishIds = [...new Set((swishListings ?? []).map((b) => b.listing_id as string))];
  const swishTotals = await swishTotalsByListing(db, swishIds);
  for (const p of payouts) {
    const sw = swishTotals.get(p.listingId);
    if (!sw) continue;
    p.swishTickets = sw.tickets;
    p.swishGrossOre = sw.grossOre - sw.refundedOre;
    p.swishDueOre = swishPartnerShareOre(sw, p.vatRate, p.partnerPercent);
  }
  // Kvällar med Swish men utan payout-rad (t.ex. bara Swish-försäljning):
  // en egen rad med noll i Stripe-delen, så att andelen ändå kommer med.
  const missing = swishIds.filter((id) => !payouts.some((p) => p.listingId === id));
  if (missing.length) {
    const { data: shares } = await db
      .from("event_revenue_shares")
      .select("listing_id, partner_profile_id, partner_percent, vat_rate, listing:listings(event_date, title)")
      .in("listing_id", missing);
    for (const sh of shares ?? []) {
      const sw = swishTotals.get(sh.listing_id as string);
      if (!sw) continue;
      const l = one(sh.listing as ListingJoin);
      const vatRate = Number(sh.vat_rate);
      const partnerPercent = Number(sh.partner_percent);
      payouts.push({
        partnerId: sh.partner_profile_id as string,
        listingId: sh.listing_id as string,
        eventDate: l?.event_date ?? "",
        title: l?.title ?? "",
        tickets: 0,
        grossOre: 0, refundedOre: 0, vatOre: 0, basisOre: 0,
        vatRate, partnerPercent,
        amountOre: 0,
        status: "paid", // inget att föra över via Stripe
        paidAt: null, transferId: null,
        swishTickets: sw.tickets,
        swishGrossOre: sw.grossOre - sw.refundedOre,
        swishDueOre: swishPartnerShareOre(sw, vatRate, partnerPercent),
      });
    }
  }

  const partnerIds = [...new Set([...payouts.map((p) => p.partnerId), ...[...supps.values()].map((s) => s.partnerId)])];
  const results: { partner: string; sentTo: string[]; skipped?: string }[] = [];

  for (const partnerId of partnerIds) {
    const statement = buildMonthlyStatement(
      period,
      payouts.filter((p) => p.partnerId === partnerId),
      [...supps.values()].filter((s) => s.partnerId === partnerId),
    );
    if (statement.rows.length === 0 && statement.earlier.length === 0) continue;

    const [{ data: partner }, { data: agreement }, { data: existing }] = await Promise.all([
      db.from("profiles").select("full_name, company_name").eq("id", partnerId).maybeSingle(),
      db.from("venue_revenue_share_defaults").select("statement_emails").eq("venue_profile_id", partnerId).maybeSingle(),
      db.from("settlement_statements").select("id, partner_sent_at, internal_sent_at").eq("partner_profile_id", partnerId).eq("period", period).maybeSingle(),
    ]);
    const partnerName = partner?.company_name || partner?.full_name || "partner";
    const partnerTo = ((agreement?.statement_emails as string[] | null) ?? []).filter(Boolean);
    const internal = internalRecipients();

    if (existing?.partner_sent_at) continue; // redan skickad till partnern
    if (existing?.internal_sent_at && partnerTo.length === 0) continue; // väntar på adress, redan sagt till

    const toPartner = partnerTo.length > 0;
    await sendSettlementStatementEmail({
      to: toPartner ? partnerTo : internal,
      cc: toPartner ? internal : [],
      partnerId,
      partnerName,
      statement,
      replyTo: REPLY_TO,
    });

    const now = new Date().toISOString();
    const { error: upErr } = await db.from("settlement_statements").upsert(
      {
        partner_profile_id: partnerId,
        period,
        recipients: toPartner ? partnerTo : [],
        totals: statement.totals,
        internal_sent_at: now,
        partner_sent_at: toPartner ? now : null,
      },
      { onConflict: "partner_profile_id,period" },
    );
    if (upErr) throw upErr;
    results.push({ partner: partnerName, sentTo: toPartner ? partnerTo : internal, skipped: toPartner ? undefined : "partnern saknar adress" });
  }

  console.log(`[settlement-statements] ${period}: ${JSON.stringify(results)}`);
  return NextResponse.json({ ok: true, period, results });
}
