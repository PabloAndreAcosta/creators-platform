import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTrialEndingEmail } from "@/lib/email/send-trial-ending";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron job: Send trial ending reminders at 7 days and 2 days before trial ends.
 * Runs daily at 08:00 UTC. Stripe's built-in trial_will_end webhook covers 3 days.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date();
  let sent = 0;

  // Find trialing subscriptions ending in ~7 days (between 6.5 and 7.5 days)
  // and ~2 days (between 1.5 and 2.5 days)
  for (const daysLeft of [7, 2]) {
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() + daysLeft);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 1);

    const { data: subs } = await admin
      .from("subscriptions")
      .select("user_id, current_period_end")
      .eq("status", "trialing")
      .gte("current_period_end", fromDate.toISOString())
      .lt("current_period_end", toDate.toISOString());

    if (!subs?.length) continue;

    for (const sub of subs) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", sub.user_id)
        .single();

      if (!profile?.email) continue;

      try {
        await sendTrialEndingEmail({
          to: profile.email,
          memberName: profile.full_name || "Medlem",
          trialEndDate: new Date(sub.current_period_end),
          daysLeft,
        });
        sent++;
      } catch (err) {
        console.error(`Trial reminder failed for ${sub.user_id}:`, err);
      }
    }
  }

  return NextResponse.json({ sent });
}
