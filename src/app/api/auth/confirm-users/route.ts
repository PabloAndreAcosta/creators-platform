import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createAdminClient();

  // List all users
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const confirmed = [];

  for (const user of users) {
    if (!user.email_confirmed_at) {
      const { error } = await supabase.auth.admin.updateUser(user.id, {
        email_confirm: true,
      });
      if (!error) {
        confirmed.push(user.email);
      }
    }
  }

  return NextResponse.json({
    message: `Bekräftade ${confirmed.length} användare`,
    confirmed,
  });
}
