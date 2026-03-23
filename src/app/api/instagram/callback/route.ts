import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
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

  // Exchange code for user access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      })
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=token`);
  }

  const { access_token: userToken } = await tokenRes.json();

  // Get pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`
  );

  if (!pagesRes.ok) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=pages`);
  }

  const pagesData = await pagesRes.json();
  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=no_pages`);
  }

  // Find the first page with a linked Instagram Business account
  let igUserId: string | null = null;
  let igUsername: string | null = null;
  let pageToken: string | null = null;

  for (const page of pages) {
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    if (!igRes.ok) continue;

    const igData = await igRes.json();
    if (igData.instagram_business_account?.id) {
      igUserId = igData.instagram_business_account.id;
      pageToken = page.access_token;

      // Get username
      const userRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}?fields=id,username&access_token=${pageToken}`
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        igUsername = userData.username || null;
      }
      break;
    }
  }

  if (!igUserId || !pageToken) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_error=no_ig_account`);
  }

  // Store Instagram connection
  await supabase
    .from("profiles")
    .update({
      instagram_user_id: igUserId,
      instagram_username: igUsername,
      instagram_access_token: pageToken,
    })
    .eq("id", userId);

  return NextResponse.redirect(`${APP_URL}/dashboard/profile?ig_connected=1`);
}
