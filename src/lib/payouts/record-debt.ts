import { debtFromRefund } from "./creator-debt";

/**
 * Bokför en skuld när en redan UTBETALD andel återbetalas.
 *
 * Villkoret är avgörande: skulden uppstår bara om avräkningen för kvällen
 * redan är utbetald. Sker återbetalningen innan dess finns ingen skuld — då
 * blir underlaget automatiskt mindre, eftersom splitEventRevenue räknar bort
 * återbetalningar innan andelen beräknas. Att bokföra en skuld i det läget
 * hade dragit av samma belopp två gånger.
 */
export async function recordRefundDebt(
  admin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> };
          maybeSingle: () => Promise<{ data: unknown }>;
        };
      };
      insert: (r: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
    };
  },
  input: { listingId: string | null; bookingId: string; refundedOre: number }
): Promise<void> {
  if (!input.listingId || input.refundedOre <= 0) return;

  // Finns ingen delning är det Ushas egen kväll, och då finns ingen partner
  // som kan bli skyldig något.
  const { data: share } = (await admin
    .from("event_revenue_shares")
    .select("partner_profile_id, partner_percent, vat_rate")
    .eq("listing_id", input.listingId)
    .maybeSingle()) as { data: { partner_profile_id: string; partner_percent: number; vat_rate: number } | null };
  if (!share?.partner_profile_id) return;

  const { data: payout } = (await admin
    .from("event_settlement_payouts")
    .select("id")
    .eq("listing_id", input.listingId)
    .eq("status", "paid")
    .maybeSingle()) as { data: { id: string } | null };
  // Inte utbetald ännu → ingen skuld. Avräkningen räknar bort returen själv.
  if (!payout) return;

  const amount = debtFromRefund({
    refundedOre: input.refundedOre,
    vatRate: Number(share.vat_rate),
    partnerPercent: Number(share.partner_percent),
  });
  if (amount <= 0) return;

  const { error } = await admin.from("creator_debts").insert({
    partner_profile_id: share.partner_profile_id,
    listing_id: input.listingId,
    booking_id: input.bookingId,
    amount_ore: amount,
    reason: "refund_after_payout",
    note: `Återbetalning efter utbetald avräkning (${input.refundedOre} öre återbetalt)`,
  });

  // 23505 = unique violation: skulden är redan bokförd. Stripe levererar om
  // vid fel, och utan den här spärren växte skulden för varje omleverans.
  if (error && error.code !== "23505") {
    console.error("creator_debts insert failed:", error.message);
  }
}
