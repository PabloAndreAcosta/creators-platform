import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reads the `capabilities_enforced` flag from app_config (service_role).
 * false (default, launch/beta) = capability gates don't block anyone — the
 * unlock mechanism is built but tools stay open. Flip to true (no deploy, within
 * the cache TTL) to start enforcing tier/token gating. Mirrors matching_access.
 */
const TTL_MS = 5 * 60_000;
let cached: { value: boolean; at: number } | null = null;

export async function capabilitiesEnforced(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;

  let value = false; // safe default: open during launch
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "capabilities_enforced")
      .maybeSingle();
    if (data?.value === true) value = true;
  } catch {
    // fall back to open
  }

  cached = { value, at: now };
  return value;
}

export function clearCapabilitiesEnforcedCache() {
  cached = null;
}
