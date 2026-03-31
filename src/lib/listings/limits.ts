import type { MemberTier } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

const TIER_LIMITS: Record<MemberTier, number | null> = {
  gratis: 3,
  guld: 15,
  premium: null, // unlimited
};

interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number | null;
}

/**
 * Check if a user can create another listing based on their tier.
 * Returns current count and whether they're allowed to create more.
 */
export async function checkListingLimit(
  userId: string,
  tier: MemberTier
): Promise<LimitCheck> {
  const max = TIER_LIMITS[tier];

  // Unlimited — no need to count
  if (max === null) {
    return { allowed: true, current: 0, max: null };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const current = count ?? 0;

  return {
    allowed: current < max,
    current,
    max,
  };
}
