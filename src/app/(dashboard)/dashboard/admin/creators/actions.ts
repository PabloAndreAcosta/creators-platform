"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/admin/guard";
import { isCreatorRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Admin: change a creator's is_company flag after signup (for those who chose the
 * wrong option or later start/stop invoicing as a company). Written via the
 * service-role client. Only meaningful for creators — venues are implicitly
 * companies, customers N/A.
 */
export async function setCreatorIsCompany(formData: FormData) {
  await assertAdmin("creators");
  const admin = createAdminClient();

  const userId = (formData.get("userId") as string)?.trim();
  const isCompany = formData.get("isCompany") === "true";
  if (!userId) return;

  const { data: target } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();
  if (!target || !isCreatorRole(target.role)) {
    redirect(`/dashboard/admin/creators?email=${encodeURIComponent((target?.email as string) ?? "")}&error=not_creator`);
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_company: isCompany })
    .eq("id", userId);

  revalidatePath("/dashboard/admin/creators");
  redirect(
    `/dashboard/admin/creators?email=${encodeURIComponent(target!.email as string)}&updated=${error ? "0" : "1"}`
  );
}
