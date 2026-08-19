import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Re-reads every Connect account from Stripe and writes its capabilities back
 * onto the profile.
 *
 * The account.updated webhook is supposed to keep these fresh, but it only ever
 * fires on a change — a seller who finished onboarding before the handler
 * existed never got one. Every account on the platform sat at
 * card_payments_enabled = false as a result, which is not cosmetic: checkout
 * reads that flag to decide whether the organizer becomes merchant of record,
 * so the whole two-flow model quietly never engaged.
 *
 * A nightly pass makes the columns eventually right no matter what happens to a
 * webhook delivery. Idempotent: it writes what Stripe currently says.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, stripe_account_id, stripe_card_payments_enabled, stripe_charges_enabled, stripe_details_submitted")
    .not("stripe_account_id", "is", null);

  if (error) {
    console.error("connect-sync: could not list profiles:", error.message);
    return NextResponse.json({ error: "Could not list accounts" }, { status: 500 });
  }

  let checked = 0;
  let changed = 0;
  const failed: string[] = [];

  for (const p of profiles ?? []) {
    checked++;
    try {
      const account = await stripe.accounts.retrieve(p.stripe_account_id as string);
      const next = {
        stripe_card_payments_enabled: account.capabilities?.card_payments === "active",
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_details_submitted: !!account.details_submitted,
      };

      const unchanged =
        next.stripe_card_payments_enabled === p.stripe_card_payments_enabled &&
        next.stripe_charges_enabled === p.stripe_charges_enabled &&
        next.stripe_details_submitted === p.stripe_details_submitted;
      if (unchanged) continue;

      const { error: writeError } = await admin.from("profiles").update(next).eq("id", p.id);
      if (writeError) {
        failed.push(p.stripe_account_id as string);
        console.error("connect-sync write failed:", p.stripe_account_id, writeError.message);
        continue;
      }
      changed++;
      console.log("connect-sync updated:", p.stripe_account_id, JSON.stringify(next));
    } catch (err) {
      // One deleted or rejected account must not stop the rest of the sweep.
      failed.push(p.stripe_account_id as string);
      console.error("connect-sync fetch failed:", p.stripe_account_id, err);
    }
  }

  return NextResponse.json({ checked, changed, failed: failed.length });
}
