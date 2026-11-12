import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { kioskAccessForOwner } from "@/lib/tickets/kiosk-access";
import { stockholmDay } from "@/lib/tickets/event-day";
import { notIndexable } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = { title: "Självinsläpp · Usha Platform", ...notIndexable() };

/**
 * Startadressen för kioskappen (public/kiosk.webmanifest).
 *
 * Ikonen på plattans startskärm måste fungera varje vecka, så den kan inte
 * peka på en enskild kväll. Här slås KVÄLLENS evenemang upp — samma regel
 * som Starta-knappen i hubben /app/dorr: bara ett evenemang i dag som
 * personen får sköta entrén för och där kioskläget är tillåtet. Finns inget
 * sådant, eller flera att välja mellan, landar plattan i hubben.
 */
export default async function KioskStartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sjalvinslapp");

  const admin = createAdminClient();
  const today = stockholmDay(new Date());
  const { data: listings } = await admin
    .from("listings")
    .select("id, user_id, title, event_date")
    .eq("listing_type", "event")
    .is("archived_at", null)
    .eq("event_date", today)
    .limit(20);

  const tonight: string[] = [];
  for (const l of listings ?? []) {
    if (!(await canOperateEntrance(admin, user.id, l))) continue;
    if (!(await kioskAccessForOwner(admin, l.user_id)).allowed) continue;
    tonight.push(l.id);
  }
  if (tonight.length === 1) redirect(`/sjalvinslapp/${tonight[0]}`);
  redirect("/app/dorr");
}
