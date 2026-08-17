import { createAdminClient } from "@/lib/supabase/admin";

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
  // Service-role, inte användarens klient. Uppslaget skedde tidigare under RLS,
  // vilket krävde en policy som gjorde ALLA aktiva koder läsbara för vem som
  // helst med anon-nyckeln — den ligger i JS-bundlen, så varje kampanjkod var
  // publik. Funktionen anropas bara från API-routes (aldrig från klient) och
  // gör själv alla behörighetskontroller, så uppslaget hör hemma här.
  //
  // Bonus: per-användarräkningen nedan blir korrekt oavsett RLS på
  // promo_code_uses, i stället för att kunna underrapportera och släppa
  // igenom fler användningar än max_uses_per_user tillåter.
  const supabase = createAdminClient();
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

  // NOTE: the global current_uses counter is incremented on PAYMENT SUCCESS in
  // the Stripe webhook (service role), NOT here. Validation must be side-effect
  // free — this function also runs from the /api/promo/validate preview endpoint
  // and on every abandoned checkout, so incrementing here burned uses that were
  // never redeemed. (It also silently failed anyway: increment_promo_uses is
  // REVOKED from the authenticated role this function runs as.)

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

// recordPromoUsage togs bort här. Den hade inga anropare och kunde inte
// fungera: den byggde en användarklient och anropade increment_promo_uses,
// som har EXECUTE återkallad från authenticated (20260515-migrationen), utan
// att kolla felet. Bokföringen sker i Stripe-webhooken med service-role vid
// betald order — se noten om current_uses ovan.
