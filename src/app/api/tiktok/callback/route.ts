import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = `${APP_URL}/api/tiktok/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Extract userId from state (format: userId_timestamp)
  const userId = state?.split("_")[0];

  if (error || !code || !userId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?tiktok_error=denied`);
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

  // Exchange code for access token
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    console.error("TikTok token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?tiktok_error=token`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const openId = tokenData.open_id;

  if (!accessToken) {
    console.error("TikTok token response missing access_token:", tokenData);
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?tiktok_error=token`);
  }

  // Fetch user info for username
  let tiktokUsername: string | null = null;
  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=display_name,username",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (userRes.ok) {
    const userData = await userRes.json();
    tiktokUsername = userData.data?.user?.username || userData.data?.user?.display_name || null;
  }

  // Store TikTok connection
  await supabase
    .from("profiles")
    .update({
      tiktok_user_id: openId,
      tiktok_username: tiktokUsername,
      tiktok_access_token: accessToken,
      tiktok_refresh_token: refreshToken,
    })
    .eq("id", userId);

  return NextResponse.redirect(`${APP_URL}/dashboard/profile?tiktok_connected=1`);
}
