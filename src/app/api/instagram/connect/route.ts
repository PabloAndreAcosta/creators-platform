import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { setOAuthStateCookie } from "@/lib/oauth/state";

const IG_APP_ID = process.env.INSTAGRAM_APP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI ?? `${APP_URL}/api/instagram/callback`;

const SCOPES = "instagram_business_basic,instagram_business_content_publish";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  if (!IG_APP_ID) {
    return NextResponse.json({ error: "Instagram App ID not configured" }, { status: 500 });
  }

  const csrfToken = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: IG_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state: csrfToken,
  });

  const response = NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );

  setOAuthStateCookie(response, user.id);

  return response;
}
