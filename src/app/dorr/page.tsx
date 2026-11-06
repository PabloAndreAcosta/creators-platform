import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { stockholmDay } from "@/lib/tickets/event-day";
import { notIndexable } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dörren · Usha Platform", ...notIndexable() };

/**
 * usha.se/dorr — kortlänken till kioskläget.
 *
 * Plattan i dörren ska inte behöva en adress med ett evenemangs-id i.
 * Den som är inloggad och får sköta entrén (ägare, admin eller crew med
 * can_scan) skickas till kioskläget för kvällens evenemang; finns inget i
 * dag tas nästa kommande. Dolda evenemang räknas också — en testkväll ska
 * gå att öppna utan att synas i kalendern.
 */
export default async function DoorShortcutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dorr");

  const admin = createAdminClient();
  const today = stockholmDay(new Date());
  const { data: listings } = await admin
    .from("listings")
    .select("id, user_id, event_date")
    .eq("listing_type", "event")
    .is("archived_at", null)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(60);

  for (const l of listings ?? []) {
    if (await canOperateEntrance(admin, user.id, l)) {
      redirect(`/app/events/${l.id}/entre/kiosk`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-2xl font-bold text-[var(--usha-white)]">Ingen kväll att öppna dörren för</h1>
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">
        Det här kontot har inget kommande evenemang att sköta entrén för. Be värden lägga till dig i
        teamet med rätt att skanna, eller logga in med värdens konto.
      </p>
      <Link href="/app" className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
        Till appen
      </Link>
    </div>
  );
}
