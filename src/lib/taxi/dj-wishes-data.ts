import { createAdminClient } from "@/lib/supabase/admin";
import type { WishRow } from "./dj-wishes";

/** Önskemål i avgränsningen med antal röster, och vilka den här personen röstat på. */
export async function loadDjWishes(scopeKey: string, viewerId: string | null): Promise<{ wishes: WishRow[]; votedIds: Set<string> }> {
  const db = createAdminClient();
  const { data: wishes } = await db.from("dj_wishes").select("id, name, status").eq("scope_key", scopeKey);
  const ids = (wishes ?? []).map((w) => w.id);
  const { data: votes } = ids.length
    ? await db.from("dj_wish_votes").select("wish_id, voter_id").in("wish_id", ids)
    : { data: [] as { wish_id: string; voter_id: string }[] };
  const count = new Map<string, number>();
  const voted = new Set<string>();
  for (const v of votes ?? []) {
    count.set(v.wish_id, (count.get(v.wish_id) ?? 0) + 1);
    if (viewerId && v.voter_id === viewerId) voted.add(v.wish_id);
  }
  return {
    wishes: (wishes ?? []).map((w) => ({ id: w.id, name: w.name, status: w.status as WishRow["status"], votes: count.get(w.id) ?? 0 })),
    votedIds: voted,
  };
}
