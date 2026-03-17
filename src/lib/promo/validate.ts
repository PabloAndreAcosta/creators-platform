import { createClient } from "@/lib/supabase/server";

export interface PromoValidation {
  valid: boolean;
  error?: string;
  promo?: {
    id: string;
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    scope: "subscription" | "ticket" | "both";
    allowed_plans: string[] | null;
    stripe_coupon_id: string | null;
  };
}

/**
 * Validate a promo code for a given user and scope.
 */
export async function validatePromoCode(
  code: string,
  userId: string,
  scope: "subscription" | "ticket",
  planKey?: string
): Promise<PromoValidation> {
  const supabase = await createClient();
  const normalizedCode = code.trim().toUpperCase();

  // Fetch the promo code
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .single();

  if (!promo) {
    return { valid: false, error: "Ogiltig promokod." };
  }

  // Check scope
  if (promo.scope !== "both" && promo.scope !== scope) {
    return {
      valid: false,
      error:
        scope === "subscription"
          ? "Denna kod gäller inte för prenumerationer."
          : "Denna kod gäller inte för biljetter.",
    };
  }

  // Check validity period
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { valid: false, error: "Denna promokod är inte aktiv ännu." };
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { valid: false, error: "Denna promokod har gått ut." };
  }

  // Check global usage limit
  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { valid: false, error: "Denna promokod har nått sin gräns." };
  }

  // Check per-user usage limit
  const { count } = await supabase
    .from("promo_code_uses")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", promo.id)
    .eq("user_id", userId);

  if (
    promo.max_uses_per_user !== null &&
    (count ?? 0) >= promo.max_uses_per_user
  ) {
    return { valid: false, error: "Du har redan använt denna promokod." };
  }

  // Check plan restriction
  if (promo.allowed_plans && planKey) {
    if (!promo.allowed_plans.includes(planKey)) {
      return { valid: false, error: "Denna promokod gäller inte för denna plan." };
    }
  }

  return {
    valid: true,
    promo: {
      id: promo.id,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      scope: promo.scope,
      allowed_plans: promo.allowed_plans,
      stripe_coupon_id: promo.stripe_coupon_id,
    },
  };
}

/**
 * Calculate the discounted price after applying a promo code.
 */
export function applyPromoDiscount(
  originalPrice: number,
  discountType: "percent" | "fixed",
  discountValue: number
): { discountedPrice: number; discountAmount: number } {
  let discountAmount: number;

  if (discountType === "percent") {
    const cappedPercent = Math.min(discountValue, 100);
    discountAmount = Math.round(originalPrice * (cappedPercent / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(discountValue, originalPrice);
  }

  return {
    discountedPrice: Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100),
    discountAmount,
  };
}

/**
 * Record promo code usage and increment counter.
 */
export async function recordPromoUsage(
  promoCodeId: string,
  userId: string,
  usedFor: "subscription" | "ticket",
  referenceId: string,
  discountAmount: number
) {
  const supabase = await createClient();

  // Record usage
  await supabase.from("promo_code_uses").insert({
    promo_code_id: promoCodeId,
    user_id: userId,
    used_for: usedFor,
    reference_id: referenceId,
    discount_amount: discountAmount,
  } as any);

  // Increment counter
  await supabase.rpc("increment_promo_uses", { promo_id: promoCodeId } as any);
}
