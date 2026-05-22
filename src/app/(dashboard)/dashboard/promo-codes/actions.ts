"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function createPromoCode(formData: FormData) {
  const t = await getTranslations("promoCodes");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errorNotLoggedIn") };

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const discount_percent = parseInt(formData.get("discount_percent") as string, 10) || 0;
  const discount_amount = parseInt(formData.get("discount_amount") as string, 10) || 0;
  const max_uses_raw = formData.get("max_uses") as string;
  const max_uses = max_uses_raw ? parseInt(max_uses_raw, 10) : null;
  const valid_until = (formData.get("valid_until") as string) || null;

  if (!code || code.length < 3) return { error: t("errorCodeMinLength") };
  if (discount_percent === 0 && discount_amount === 0) return { error: t("errorNoDiscount") };
  if (discount_percent > 100) return { error: t("errorPercentTooHigh") };

  // Check uniqueness
  const { data: existing } = await supabase
    .from("creator_promo_codes")
    .select("id")
    .eq("code", code)
    .single();

  if (existing) return { error: t("errorCodeExists") };

  const { error } = await supabase
    .from("creator_promo_codes")
    .insert({
      creator_id: user.id,
      code,
      discount_percent,
      discount_amount,
      max_uses,
      valid_until: valid_until ? new Date(valid_until).toISOString() : null,
    } as any);

  if (error) return { error: t("errorCreateFailed") };

  revalidatePath("/dashboard/promo-codes");
  return { success: true };
}

export async function deletePromoCode(promoId: string) {
  const t = await getTranslations("promoCodes");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errorNotLoggedIn") };

  const { error } = await supabase
    .from("creator_promo_codes")
    .delete()
    .eq("id", promoId)
    .eq("creator_id", user.id);

  if (error) return { error: t("errorDeleteFailed") };

  revalidatePath("/dashboard/promo-codes");
  return { success: true };
}
