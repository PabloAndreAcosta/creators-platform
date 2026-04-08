import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/referral — called once after signup to:
 * 1. Generate a referral_code if missing
 * 2. Process referred_by_code from signup metadata
 * 3. Create welcome promo code for referred users
 */
export async function POST(req: NextRequest) {
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

  let updated = false;
  const updates: Record<string, unknown> = {};

  // Generate referral code if missing
  if (!profile.referral_code) {
    const code = generateCode();
    updates.referral_code = code;
    updated = true;
  }

  // Process referral from signup metadata
  const referredByCode = user.user_metadata?.referred_by_code;
  if (referredByCode && !profile.referred_by) {
    // Look up the referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referredByCode.toUpperCase())
      .single();

    if (referrer && referrer.id !== user.id) {
      updates.referred_by = referrer.id;
      updated = true;

      // Create welcome promo code (50 kr) for the new user
      await supabase.from("promo_codes").insert({
        code: `VÄLKOMMEN-${generateCode()}`,
        discount_type: "fixed",
        discount_amount: 50,
        scope: "ticket",
        max_uses: 1,
        times_used: 0,
        is_active: true,
        description: `Välkomstrabatt via inbjudan från ${referredByCode}`,
      });
    }
  }

  if (updated) {
    await supabase.from("profiles").update(updates).eq("id", user.id);
  }

  return NextResponse.json({
    referralCode: profile.referral_code || updates.referral_code,
    referredBy: profile.referred_by || updates.referred_by || null,
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

  return NextResponse.json({
    referralCode: profile?.referral_code || null,
    referralCount: count || 0,
    referralLink: profile?.referral_code
      ? `https://usha.se/signup?ref=${profile.referral_code}`
      : null,
  });
}
