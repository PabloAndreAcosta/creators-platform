import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Total storage a single account (creator) may occupy across all upload
 * buckets. Enforced server-side by both upload routes.
 */
export const STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

/**
 * Bytes the user currently occupies across the app's upload buckets, via the
 * `user_storage_bytes` SECURITY DEFINER function (callable by service_role).
 *
 * Returns 0 on any error so a transient DB hiccup can't block a legitimate
 * upload — the per-file size cap still applies as a backstop.
 */
export async function getUsedStorageBytes(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("user_storage_bytes", {
    p_user: userId,
  });
  if (error || data == null) return 0;
  return typeof data === "number" ? data : Number(data) || 0;
}

export function bytesToMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/**
 * Checks whether adding `incomingBytes` would exceed the account's quota.
 * `used` is fetched fresh so concurrent uploads are accounted for.
 */
export async function checkStorageQuota(
  admin: AdminClient,
  userId: string,
  incomingBytes: number,
): Promise<{ ok: true } | { ok: false; used: number; remaining: number }> {
  const used = await getUsedStorageBytes(admin, userId);
  if (used + incomingBytes > STORAGE_QUOTA_BYTES) {
    return { ok: false, used, remaining: Math.max(0, STORAGE_QUOTA_BYTES - used) };
  }
  return { ok: true };
}
