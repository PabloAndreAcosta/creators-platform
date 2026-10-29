import { createAdminClient } from "@/lib/supabase/admin";
import { outstandingDebtOre } from "@/lib/payouts/creator-debt";
import { buildUnderlag, type UnderlagCreator } from "./underlag";

/**
 * Läser allt som väntar på att skickas till SAMekonomi och räknar underlaget.
 *
 * Sidan, CSV-filen och "markera som skickad" går alla genom den här, så att
 * det som visas, det som laddas ned och det som bokförs aldrig kan skilja sig.
 * Innehåller namn och löner: bara för hel admin (sidan kräver "full").
 */
export async function loadPendingUnderlag(onlyCreatorId?: string) {
  const db = createAdminClient();
  let q = db
    .from("payroll_shadow_lines")
    .select("id, creator_id, pass_date, labour_budget_ore")
    .eq("live", true)
    .is("sam_submitted_at", null)
    .is("voided_at", null);
  if (onlyCreatorId) q = q.eq("creator_id", onlyCreatorId);
  const { data: lines, error } = await q;
  if (error) throw error;

  const ids = [...new Set((lines ?? []).map((l) => l.creator_id))];
  const [{ data: profiles }, { data: debts }] = await Promise.all([
    ids.length
      ? db.from("profiles").select("id, full_name, bankid_name, bankid_verified_at, category, creator_subcategory").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? db.from("creator_debts").select("partner_profile_id, amount_ore").in("partner_profile_id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const creators = new Map<string, UnderlagCreator>();
  for (const p of profiles ?? []) {
    creators.set(p.id, {
      id: p.id,
      // Namnet från BankID är det juridiska — det SAMekonomi matchar mot.
      name: p.bankid_name || p.full_name,
      verified: !!p.bankid_verified_at,
      category: p.category,
      subcategory: p.creator_subcategory,
    });
  }
  const debtByCreator = new Map<string, number>();
  for (const id of ids) {
    debtByCreator.set(id, outstandingDebtOre((debts ?? []).filter((d) => d.partner_profile_id === id)));
  }

  return buildUnderlag(lines ?? [], creators, debtByCreator);
}
