import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  await supabase
    .from("profiles")
    .update({
      tiktok_user_id: null,
      tiktok_username: null,
      tiktok_access_token: null,
      tiktok_refresh_token: null,
    })
    .eq("id", user.id);

  return NextResponse.redirect(`${APP_URL}/dashboard/profile`);
}
