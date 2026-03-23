"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPromoCode(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const discount_percent = parseInt(formData.get("discount_percent") as string, 10) || 0;
  const discount_amount = parseInt(formData.get("discount_amount") as string, 10) || 0;
  const max_uses_raw = formData.get("max_uses") as string;
  const max_uses = max_uses_raw ? parseInt(max_uses_raw, 10) : null;
  const valid_until = (formData.get("valid_until") as string) || null;

  if (!code || code.length < 3) return { error: "Koden måste vara minst 3 tecken" };
  if (discount_percent === 0 && discount_amount === 0) return { error: "Ange rabatt i procent eller fast belopp" };
  if (discount_percent > 100) return { error: "Rabatten kan inte vara över 100%" };

  // Check uniqueness
  const { data: existing } = await supabase
    .from("creator_promo_codes")
    .select("id")
    .eq("code", code)
    .single();

  if (existing) return { error: "Koden finns redan" };

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

  if (error) return { error: "Kunde inte skapa promo-kod" };

  revalidatePath("/dashboard/promo-codes");
  return { success: true };
}

export async function deletePromoCode(promoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("creator_promo_codes")
    .delete()
    .eq("id", promoId)
    .eq("creator_id", user.id);

  if (error) return { error: "Kunde inte ta bort promo-kod" };

  revalidatePath("/dashboard/promo-codes");
  return { success: true };
}
