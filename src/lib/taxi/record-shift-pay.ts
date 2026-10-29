import { createAdminClient } from "@/lib/supabase/admin";
import { assignmentRoute, payrollRouteLive } from "@/lib/assignments/route";
import { buildShiftPayrollLine } from "./shift-pay";

/**
 * Ett betalt pass är incheckat: skriv löneraden för den utan bolag.
 *
 * Den med bolag fakturerar själv och får ingen rad. Raden är skarp (live)
 * bara när lönevägen är på för arrangör och kreatör — annars skuggräkning,
 * som uppdragen. En redan skickad rad räknas aldrig om.
 */
export async function recordShiftPayrollLine(signupId: string): Promise<"written" | "skipped"> {
  const db = createAdminClient();
  const { data: s } = await db
    .from("taxi_signups")
    .select("id, dancer_id, checked_in_at, shift:taxi_shifts!inner(pay_ore, starts_at, listing:listings!inner(user_id))")
    .eq("id", signupId)
    .maybeSingle();
  type Row = { id: string; dancer_id: string; checked_in_at: string | null; shift: { pay_ore: number; starts_at: string; listing: { user_id: string } } };
  const row = s as unknown as Row | null;
  if (!row?.checked_in_at || !(row.shift.pay_ore > 0)) return "skipped";

  const { data: p } = await db
    .from("profiles")
    .select("is_company, company_verified_at, is_usha_owned_seller, bankid_birth_date")
    .eq("id", row.dancer_id)
    .single();
  const route = assignmentRoute({
    is_company: p?.is_company ?? null,
    company_verified_at: p?.company_verified_at ?? null,
    is_usha_owned_seller: p?.is_usha_owned_seller ?? null,
  });
  if (route !== "payroll") return "skipped";

  const { data: existing } = await db.from("payroll_shadow_lines").select("sam_submitted_at").eq("shift_signup_id", signupId).maybeSingle();
  if (existing?.sam_submitted_at) return "skipped";

  const line = buildShiftPayrollLine({
    signupId,
    creatorId: row.dancer_id,
    startsAt: row.shift.starts_at,
    payOre: row.shift.pay_ore,
    birthYear: p?.bankid_birth_date ? Number(String(p.bankid_birth_date).slice(0, 4)) : null,
  });
  const live = payrollRouteLive({ customerId: row.shift.listing.user_id, creatorId: row.dancer_id });
  const { error } = await db.from("payroll_shadow_lines").upsert({ ...line, live }, { onConflict: "shift_signup_id" });
  if (error) throw error;
  return "written";
}
