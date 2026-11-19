import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

/**
 * Cron (varje hel timme): påminn volontären om att checka in när passet börjar.
 *
 * Volontären checkar in sig själv på /app/taxi/[kväll] från 30 minuter före
 * passet till dess slut. Ett pass utan incheckning blir en varning när det tar
 * slut, så en volontär som stod där hela kvällen men aldrig tryckte på knappen
 * fick en varning (Sammy, 12 nov). Notisen går som push och leder rakt till
 * knappen.
 *
 * Fönster: pass som börjar inom 40 minuter eller började för högst en timme
 * sedan och inte är slut. Med en körning varje hel timme fångas varje pass
 * en gång; checkin_reminded_at hindrar dubbletter om jobbet körs oftare.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 40 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("taxi_signups")
    .select("id, dancer_id, shift:taxi_shifts!inner(listing_id, starts_at, ends_at, listing:listings(title))")
    .eq("status", "booked")
    .is("checked_in_at", null)
    .is("checkin_reminded_at", null)
    .gte("shift.starts_at", from)
    .lte("shift.starts_at", to)
    .gt("shift.ends_at", now.toISOString());
  if (error) {
    console.error("taxi-checkin-reminders query failed:", error);
    return NextResponse.json({ error: "query" }, { status: 500 });
  }

  type Row = {
    id: string;
    dancer_id: string;
    shift: { listing_id: string; starts_at: string; ends_at: string; listing: { title: string } | null } | null;
  };

  let sent = 0;
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.shift) continue;
    // Markera först: hellre en missad påminnelse än två.
    const { data: marked } = await admin
      .from("taxi_signups")
      .update({ checkin_reminded_at: now.toISOString() })
      .eq("id", r.id)
      .is("checkin_reminded_at", null)
      .select("id");
    if (!marked?.length) continue;
    await createNotification({
      userId: r.dancer_id,
      type: "volunteer_checkin",
      titleKey: "volunteerCheckinTitle",
      bodyKey: "volunteerCheckinMsg",
      params: { title: r.shift.listing?.title ?? "" },
      link: `/app/taxi/${r.shift.listing_id}`,
    }).catch((e) => console.error("volunteer check-in notification failed:", e));
    sent++;
  }

  return NextResponse.json({ sent });
}
