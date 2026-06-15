import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Current "nycklar" balance for a profile = sum of all ledger deltas.
 * Works with any client; RLS lets a user read their own ledger, and the
 * service-role/admin client can read anyone's.
 */
export async function getTokenBalance(
  client: SupabaseClient,
  profileId: string
): Promise<number> {
  const { data, error } = await client
    .from("token_ledger")
    .select("delta")
    .eq("profile_id", profileId);
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + (r.delta ?? 0), 0);
}
