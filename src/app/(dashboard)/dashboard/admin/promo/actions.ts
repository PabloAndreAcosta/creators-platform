"use server";

import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminById } from "@/lib/admin/check";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Errors from these actions are shown verbatim in a toast, so they are
 * translated here rather than handed to the client as Swedish text. A server
 * action still runs inside the request, so it can read the caller's locale.
 */
async function errors() {
  return getTranslations("adminPromo");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdminById(user.id))) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function createPromoCode(formData: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const description = (formData.get("description") as string)?.trim() || null;
  const discount_type = formData.get("discount_type") as "percent" | "fixed";
  const discount_value = parseFloat(formData.get("discount_value") as string);
  const scope = formData.get("scope") as "subscription" | "ticket" | "both";
  const max_uses = formData.get("max_uses") as string;
  const max_uses_per_user = formData.get("max_uses_per_user") as string;
  const valid_until = formData.get("valid_until") as string;

  const t = await errors();

  if (!code || !discount_type || !discount_value || !scope) {
    return { error: t("errorRequiredFields") };
  }

  if (discount_type === "percent" && (discount_value < 1 || discount_value > 100)) {
    return { error: t("errorPercentRange") };
  }

  if (discount_type === "fixed" && discount_value < 1) {
    return { error: t("errorFixedMin") };
  }

  // Check for duplicate code
  const { data: existing } = await admin
    .from("promo_codes")
    .select("id")
    .eq("code", code)
    .single();

  if (existing) {
    return { error: t("errorDuplicate", { code }) };
  }

  const { error } = await admin.from("promo_codes").insert({
    code,
    description,
    discount_type,
    discount_value,
    scope,
    max_uses: max_uses ? parseInt(max_uses, 10) || null : null,
    max_uses_per_user: max_uses_per_user ? parseInt(max_uses_per_user, 10) || 1 : 1,
    valid_until: valid_until || null,
    created_by: user.id,
  });

  if (error) {
    console.error("Create promo error:", error);
    return { error: t("errorCreate") };
  }

  redirect("/dashboard/admin/promo?created=true");
}

export async function togglePromoCode(id: string, active: boolean) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("promo_codes")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    return { error: (await errors())("errorToggle") };
  }

  revalidatePath("/dashboard/admin/promo");
  return { success: true };
}

export async function deletePromoCode(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("promo_codes")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: (await errors())("errorDelete") };
  }

  revalidatePath("/dashboard/admin/promo");
  return { success: true };
}
