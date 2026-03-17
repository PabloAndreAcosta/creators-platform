import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI ?? `${APP_URL}/api/facebook/callback`;

// Scopes needed for Pages post management (pages_manage_events was deprecated)
const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
].join(",");

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  if (!FB_APP_ID) {
    return NextResponse.json({ error: "Facebook App ID not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state: user.id, // Pass user ID to verify in callback
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  );
}
