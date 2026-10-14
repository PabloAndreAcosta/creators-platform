import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";
import { pushConfigured } from "@/lib/push/vapid";

/**
 * Skickar en push till den inloggade användaren själv.
 *
 * Finns för att en notiskanal som aldrig testats är en kanal vi inte vet
 * fungerar. En prenumeration kan tystna månader efter att den skapats — när
 * webbläsaren rensar data, när appen installeras om, när nycklarna byts — och
 * det syns inte förrän något viktigt uteblir. Den här knappen gör felvägen
 * synlig på två sekunder i stället för vid nästa biljettförsäljning.
 *
 * Skapar ingen notisrad: det här är ett livstecken, inte en händelse.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!pushConfigured()) {
    return NextResponse.json({ error: "push_unconfigured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count) {
    return NextResponse.json({ error: "no_subscription", devices: 0 }, { status: 409 });
  }

  await sendPushToUser(user.id, {
    title: "Usha Platform",
    body: "Testnotis. Ser du den här fungerar pushen på den här enheten.",
    url: "/app/notifications",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true, devices: count });
}
