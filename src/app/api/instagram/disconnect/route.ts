import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      instagram_user_id: null,
      instagram_username: null,
      instagram_access_token: null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Kunde inte koppla bort Instagram" }, { status: 500 });
  }

  return NextResponse.redirect(`${APP_URL}/dashboard/profile`);
}
