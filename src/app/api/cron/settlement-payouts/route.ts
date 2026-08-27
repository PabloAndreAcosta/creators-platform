import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { runSettlementPayouts } from "@/lib/settlements/run-payouts";

/**
 * Cron: för över partnerns andel för kvällar som varit.
 *
 * Körs en gång per dygn. Med payout_delay_days = 1 innebär det att pengarna går
 * dagen efter arrangemanget.
 *
 * Överföringar är avstängda tills SETTLEMENT_PAYOUTS_ENABLED=true. Dessförinnan
 * räknar jobbet ut allt och skriver en rad med status "dry_run" utan att flytta
 * pengar, så att beloppen går att jämföra mot Stripe innan det blir skarpt.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSettlementPayouts();

    console.log(
      `[settlement-payouts] ${result.today} live=${result.live} ` +
        `betalda=${result.paid} torrkörda=${result.dryRun} ` +
        `blockerade=${result.blocked.length} misslyckade=${result.failed.length} ` +
        `summa=${(result.totalOre / 100).toFixed(2)} kr`
    );
    for (const b of result.blocked) console.log(`[settlement-payouts] blockerad ${b.title}: ${b.reason}`);
    for (const f of result.failed) console.error(`[settlement-payouts] MISSLYCKAD ${f.title}: ${f.error}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[settlement-payouts] körningen kraschade:", error);
    return NextResponse.json({ error: "Settlement payout run failed" }, { status: 500 });
  }
}
