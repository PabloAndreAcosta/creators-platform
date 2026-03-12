import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  await supabase
    .from("profiles")
    .update({
      facebook_page_id: null,
      facebook_page_name: null,
      facebook_page_access_token: null,
    })
    .eq("id", user.id);

  return NextResponse.redirect(`${APP_URL}/app/events`);
}
