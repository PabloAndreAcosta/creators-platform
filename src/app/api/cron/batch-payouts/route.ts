import { NextRequest, NextResponse } from "next/server";
import { weeklyPayoutBatch } from "@/lib/stripe/payouts";

/**
 * Cron job: Process weekly batch payouts for all creators.
 * Runs every Monday at 06:00 UTC.
 *
 * Configure in vercel.json:
 * { "crons": [{ "path": "/api/cron/batch-payouts", "schedule": "0 6 * * 1" }] }
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await weeklyPayoutBatch();

    console.log(
      `Batch payouts completed: ${result.processed}/${result.total} processed, ${result.errors.length} errors`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Batch payout cron failed:", error);
    return NextResponse.json(
      { error: "Batch payout failed" },
      { status: 500 }
    );
  }
}
