import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePromoCode, applyPromoDiscount } from "@/lib/promo/validate";

/**
 * POST /api/promo/validate
 * Validate a promo code and return discount info.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, scope, planKey, originalPrice } = await req.json();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    if (!code || !scope) {
      return NextResponse.json({ error: "Kod och scope krävs" }, { status: 400 });
    }

    const result = await validatePromoCode(code, user.id, scope, planKey);

    if (!result.valid || !result.promo) {
      return NextResponse.json({ valid: false, error: result.error });
    }

    // Calculate discount preview if price provided
    let preview = null;
    if (originalPrice && originalPrice > 0) {
      preview = applyPromoDiscount(
        originalPrice,
        result.promo.discount_type,
        result.promo.discount_value
      );
    }

    return NextResponse.json({
      valid: true,
      discount_type: result.promo.discount_type,
      discount_value: result.promo.discount_value,
      preview,
    });
  } catch (error) {
    console.error("Promo validate error:", error);
    return NextResponse.json(
      { error: "Kunde inte validera promokod" },
      { status: 500 }
    );
  }
}
