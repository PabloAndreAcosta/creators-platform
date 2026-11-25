import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { setOAuthStateCookie } from "@/lib/oauth/state";
import { isTikTokConfigured, TIKTOK_UNAVAILABLE_PATH } from "@/lib/social/tiktok-config";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = `${APP_URL}/api/tiktok/callback`;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  // Nycklarna saknas än. Tidigare 500 med ett tekniskt fel; nu tillbaka till
  // kopplingssidan, där knappen står gråmarkerad som "Kommer snart".
  if (!CLIENT_KEY || !isTikTokConfigured()) {
    return NextResponse.redirect(`${APP_URL}${TIKTOK_UNAVAILABLE_PATH}`);
  }

  const csrfToken = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: "user.info.basic,video.list",
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state: csrfToken,
  });

  const response = NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  );

  setOAuthStateCookie(response, user.id, csrfToken);

  return response;
}
