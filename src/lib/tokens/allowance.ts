import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Monthly nyckel allowance per subscription tier. Paid tiers get a bonus pot to
 * spend on token-gated extras; gratis/silver get none (they buy nycklar — the
 * token alternative to subscribing). Preliminary amounts — tweak here.
 * Unknown tiers fall back to 0.
 */
export const MONTHLY_ALLOWANCE: Record<string, number> = {
  gratis: 0,
  silver: 0,
  guld: 3,
  premium: 8,
};

export function monthlyAllowance(tier: string | null | undefined): number {
  return MONTHLY_ALLOWANCE[(tier || "").toLowerCase()] ?? 0;
}

/** Current allowance period as 'YYYY-MM' (UTC), the idempotency key per month. */
export function currentAllowancePeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Credit this month's tier allowance if not already credited. Idempotent per
 * (profile, month) via a unique allowance ref in the DB function. Lazy: call on
 * balance read and before an unlock — no cron needed. Pass the service-role
 * (admin) client. Never throws into the caller's flow.
 */
export async function ensureMonthlyAllowance(
  admin: SupabaseClient,
  profileId: string,
  tier: string | null | undefined
): Promise<void> {
  const amount = monthlyAllowance(tier);
  if (amount <= 0) return;
  try {
    await admin.rpc("grant_monthly_allowance", {
      p_profile: profileId,
      p_amount: amount,
      p_period: currentAllowancePeriod(),
    });
  } catch {
    // Allowance crediting is best-effort; never block balance/unlock on it.
  }
}
