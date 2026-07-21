import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Passwordless / magic-link + recovery landing route.
//
// A device with a *revoked* refresh token loops on /token (grant_type=
// refresh_token) forever: it gets rate-limited (429) before Supabase can
// return the terminal "refresh_token_not_found", so gotrue-js keeps retrying
// and never gives up — locking the user (and that IP) out of ALL auth.
//
// This route breaks that: verifyOtp uses a *different* endpoint/rate-limit
// bucket (email OTP, not token refresh), so it works even while /token is
// rate-limited, and it writes a brand-new valid session cookie that OVERWRITES
// the corrupt one — so the loop stops on the next page load. Generate a link
// with the admin API (auth.admin.generateLink) and point it here:
//   https://usha.se/confirm?token_hash=<properties.hashed_token>&type=magiclink&next=/app
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "magiclink") as EmailOtpType;
  const next = searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (token_hash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=magic`);
}
