import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const IG_APP_ID = process.env.INSTAGRAM_APP_ID!;
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI ?? `${APP_URL}/api/instagram/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=denied`);
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  // Step 1: Exchange code for short-lived token
  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: IG_APP_ID,
      client_secret: IG_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Instagram token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=token`);
  }

  const tokenData = await tokenRes.json();
  const shortLivedToken = tokenData.access_token;
  const igUserId = String(tokenData.user_id);

  // Step 2: Exchange for long-lived token (60 days)
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?` +
      new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: IG_APP_SECRET,
        access_token: shortLivedToken,
      })
  );

  let accessToken = shortLivedToken;
  if (longLivedRes.ok) {
    const longLivedData = await longLivedRes.json();
    accessToken = longLivedData.access_token;
  }

  // Step 3: Get username
  let igUsername: string | null = null;
  const userRes = await fetch(
    `https://graph.instagram.com/v19.0/me?fields=username&access_token=${accessToken}`
  );
  if (userRes.ok) {
    const userData = await userRes.json();
    igUsername = userData.username || null;
  }

  // Store Instagram connection
  await supabase
    .from("profiles")
    .update({
      instagram_user_id: igUserId,
      instagram_username: igUsername,
      instagram_access_token: accessToken,
    })
    .eq("id", userId);

  return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_connected=1`);
}
