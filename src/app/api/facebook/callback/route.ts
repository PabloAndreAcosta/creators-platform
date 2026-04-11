import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getOAuthStateFromCookie,
  clearOAuthStateCookie,
  setFbPagesCookie,
} from "@/lib/oauth/state";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI ?? `${APP_URL}/api/facebook/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Get verified user ID from signed cookie instead of state param
  const oauthState = getOAuthStateFromCookie(req);
  const userId = oauthState?.userId;

  if (error || !code || !userId) {
    const response = NextResponse.redirect(`${APP_URL}/app/events?fb_error=denied`);
    clearOAuthStateCookie(response);
    return response;
  }

  // Use admin client — callback runs on ngrok domain where session cookies don't exist
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    const response = NextResponse.redirect(`${APP_URL}/login`);
    clearOAuthStateCookie(response);
    return response;
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
    const response = NextResponse.redirect(`${APP_URL}/app/events?fb_error=token`);
    clearOAuthStateCookie(response);
    return response;
  }

  const { access_token: userToken } = await tokenRes.json();

  // Get the list of pages this user manages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`
  );

  if (!pagesRes.ok) {
    const response = NextResponse.redirect(`${APP_URL}/app/events?fb_error=pages`);
    clearOAuthStateCookie(response);
    return response;
  }

  const pagesData = await pagesRes.json();
  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    const response = NextResponse.redirect(`${APP_URL}/app/events?fb_error=no_pages`);
    clearOAuthStateCookie(response);
    return response;
  }

  // If multiple pages, store page data in a signed cookie and redirect to select-page UI
  if (pages.length > 1) {
    const response = NextResponse.redirect(`${APP_URL}/app/events/select-page`);
    setFbPagesCookie(
      response,
      pages.map((p) => ({ id: p.id, name: p.name, token: p.access_token }))
    );
    clearOAuthStateCookie(response);
    return response;
  }

  const page = pages[0];

  // Store page info on the profile
  await supabase
    .from("profiles")
    .update({
      facebook_page_id: page.id,
      facebook_page_name: page.name,
      facebook_page_access_token: page.access_token,
    })
    .eq("id", userId);

  const response = NextResponse.redirect(`${APP_URL}/app/events?fb_connected=1`);
  clearOAuthStateCookie(response);
  return response;
}
