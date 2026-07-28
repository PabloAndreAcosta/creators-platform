import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/referral — called once after signup to:
 * 1. Generate a referral_code if missing
 * 2. Process referred_by_code from signup metadata
 * 3. Create welcome promo code for referred users
 */
export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
  const rl = rateLimit(getRateLimitKey(req, "referral-process"), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "För många försök. Försök igen senare." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, referral_code, referred_by")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil hittades inte" }, { status: 404 });
  }

  let generatedCode: string | null = null;

  // Generate referral code if missing (independent of referral attribution).
  if (!profile.referral_code) {
    generatedCode = generateCode();
    await supabase.from("profiles").update({ referral_code: generatedCode }).eq("id", user.id);
  }

  // Process referral from signup metadata.
  const referredByCode = user.user_metadata?.referred_by_code;
  let claimedReferredBy: string | null = null;
  if (referredByCode && !profile.referred_by) {
    // Look up the referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referredByCode.toUpperCase())
      .single();

    if (referrer && referrer.id !== user.id) {
      // Atomic claim: only the first call where referred_by IS NULL wins, so
      // concurrent "process once after signup" calls can't double-attribute or
      // mint duplicate welcome promos.
      const { data: claimed } = await supabase
        .from("profiles")
        .update({ referred_by: referrer.id })
        .eq("id", user.id)
        .is("referred_by", null)
        .select("id")
        .maybeSingle();

      if (claimed) {
        claimedReferredBy = referrer.id;

        // Create the welcome promo (50 kr off a ticket) — only on a fresh claim,
        // so it happens exactly once per referral. Written via the service-role
        // client: promo_codes writes are service-role only, and correct columns
        // are discount_value / current_uses (not discount_amount / times_used).
        // created_by = the recipient so it's attributable and shown back to them.
        const welcomeCode = `VÄLKOMMEN-${generateCode()}`;
        const { error: promoErr } = await createAdminClient().from("promo_codes").insert({
          code: welcomeCode,
          discount_type: "fixed",
          discount_value: 50,
          scope: "ticket",
          max_uses: 1,
          max_uses_per_user: 1,
          is_active: true,
          created_by: user.id,
          description: `Välkomstrabatt via inbjudan från ${referredByCode}`,
        });
        if (promoErr) console.error("welcome promo insert failed:", promoErr);
      }
    }
  }

  return NextResponse.json({
    referralCode: profile.referral_code || generatedCode,
    referredBy: profile.referred_by || claimedReferredBy || null,
  });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * GET /api/referral — get current user's referral info
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, referred_by")
    .eq("id", user.id)
    .single();

  // Count referrals
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", user.id);

  // The user's own welcome promo (from being referred), if unredeemed. created_by
  // is the recipient, and the "Active promo codes are readable" policy lets them
  // read it. Only surface it while it still has a use left.
  const { data: welcome } = await supabase
    .from("promo_codes")
    .select("code, discount_value, max_uses, current_uses")
    .eq("created_by", user.id)
    .eq("is_active", true)
    .like("code", "VÄLKOMMEN-%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const welcomeUnused =
    welcome && (welcome.max_uses === null || (welcome.current_uses ?? 0) < welcome.max_uses)
      ? welcome
      : null;

  return NextResponse.json({
    referralCode: profile?.referral_code || null,
    referralCount: count || 0,
    referralLink: profile?.referral_code
      ? `https://usha.se/signup?ref=${profile.referral_code}`
      : null,
    welcomeCode: welcomeUnused?.code ?? null,
    welcomeDiscount: welcomeUnused ? Number(welcomeUnused.discount_value) : null,
  });
}
