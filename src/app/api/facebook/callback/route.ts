import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = `${APP_URL}/api/facebook/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user ID
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/app/events?fb_error=denied`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state) {
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
    return NextResponse.redirect(`${APP_URL}/app/events?fb_error=token`);
  }

  const { access_token: userToken } = await tokenRes.json();

  // Get the list of pages this user manages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`
  );

  if (!pagesRes.ok) {
    return NextResponse.redirect(`${APP_URL}/app/events?fb_error=pages`);
  }

  const pagesData = await pagesRes.json();
  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    return NextResponse.redirect(`${APP_URL}/app/events?fb_error=no_pages`);
  }

  // If multiple pages, let user choose via select-page UI
  if (pages.length > 1) {
    const pagesParam = encodeURIComponent(
      JSON.stringify(pages.map((p) => ({ id: p.id, name: p.name, token: p.access_token })))
    );
    return NextResponse.redirect(`${APP_URL}/app/events/select-page?pages=${pagesParam}`);
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
    .eq("id", user.id);

  return NextResponse.redirect(`${APP_URL}/app/events?fb_connected=1`);
}
