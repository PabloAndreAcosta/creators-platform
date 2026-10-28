"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPendingUnderlag } from "@/lib/assignments/load-underlag";

const PATH = "/dashboard/admin/lon";

/**
 * En kreatörs rad är inlagd i SAMekonomis samlingsfaktura.
 *
 * Underlaget räknas om här i stället för att lita på beloppen i formuläret:
 * det som bokförs ska vara exakt det sidan visade, och kan inte ändras från
 * webbläsaren. Raderna märks som skickade, och skuld som drogs av kvittas.
 */
export async function markSubmitted(formData: FormData) {
  await assertAdmin("full");
  const creatorId = (formData.get("creatorId") as string)?.trim();
  const reference = (formData.get("reference") as string)?.trim();
  if (!creatorId || !reference) redirect(`${PATH}?notice=missing`);

  const { rows } = await loadPendingUnderlag(creatorId);
  const row = rows[0];
  if (!row || row.blocked) redirect(`${PATH}?notice=blocked`);

  const db = createAdminClient();
  const { error } = await db
    .from("payroll_shadow_lines")
    .update({ sam_submitted_at: new Date().toISOString(), sam_reference: reference })
    .in("id", row.lineIds)
    .is("sam_submitted_at", null);
  if (error) throw error;

  if (row.debtDeductedOre > 0) {
    await db.from("creator_debts").insert({
      partner_profile_id: creatorId,
      amount_ore: -row.debtDeductedOre,
      reason: "offset",
      note: `Kvittat mot löneunderlag ${reference}`,
    });
  }

  revalidatePath(PATH);
  redirect(`${PATH}?notice=submitted`);
}
