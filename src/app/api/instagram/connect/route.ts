import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const params = new URLSearchParams({
    client_id: IG_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state: user.id,
  });

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );
}
