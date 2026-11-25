import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwnerOrManager } from "@/lib/listings/manage-access";

/**
 * Förhandsgranskning av ett utkast (is_active = false) på den publika sidan.
 *
 * "Förhandsgranska" i /app/events och /dashboard/listings länkar till samma
 * adress som publiken använder. Den visar bara aktiva rader, så ägaren fick
 * 404 på sitt eget utkast. Här avgörs vem som ändå får se det: ägaren och den
 * som får administrera evenemanget (medarrangör med can_manage, lokalteam med
 * behörigheten "events") — samma krets som får öppna redigeraren.
 *
 * Alla andra får null, och sidan svarar 404 precis som förut.
 */
export async function loadPreviewableDraft(
  admin: SupabaseClient,
  opts: { column: "id" | "slug"; value: string; viewerId: string; columns: string }
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("listings")
    .select(opts.columns)
    .eq(opts.column, opts.value)
    .eq("is_active", false)
    .maybeSingle();
  const row = data as (Record<string, unknown> & { id: string; user_id: string }) | null;
  if (!row) return null;
  const allowed = await isOwnerOrManager(admin, opts.viewerId, row.id, row.user_id);
  return allowed ? row : null;
}
