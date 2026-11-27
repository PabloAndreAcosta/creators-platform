import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { loadStrikeFacts, loadUpcomingEvenings } from "@/lib/taxi/data";
import { strikeStatus } from "@/lib/taxi/rules";
import { stockholmToday } from "@/lib/time";
import { approvalScopeKey } from "@/lib/taxi/approvals";
import {
  CHOOSE_REMINDER_TYPE,
  chooseShiftReminders,
  listingIdFromLink,
  sentKey,
  type ChooseApproval,
} from "@/lib/taxi/reminders";

/**
 * Cron (kl. 10 svensk vintertid, 11 sommartid): "Du är godkänd – välj pass".
 *
 * Till den som är godkänd som volontär i kvällens serie (eller hos arrangören)
 * men inte har bokat något pass på en kväll i dag där det finns lediga pass i
 * en roll hen är godkänd för. Högst en per kväll och volontär: redan skickade
 * hittas i notifications, så ingen ny kolumn behövs. Urvalet står i
 * lib/taxi/reminders.ts.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = stockholmToday(now);
  const evenings = (await loadUpcomingEvenings(today)).filter((e) => e.event_date === today);
  if (evenings.length === 0) return NextResponse.json({ sent: 0 });

  const scopes = [...new Set(evenings.map((e) => approvalScopeKey(e)))];
  const shiftIds = evenings.flatMap((e) => e.shifts.map((s) => s.id));
  const [{ data: approvals, error: aErr }, { data: signups, error: sErr }] = await Promise.all([
    admin
      .from("volunteer_approvals")
      .select("volunteer_id, scope_key, role, status, decided_at")
      .in("scope_key", scopes)
      .eq("status", "approved"),
    shiftIds.length
      ? admin.from("taxi_signups").select("shift_id, dancer_id").in("shift_id", shiftIds).eq("status", "booked")
      : Promise.resolve({ data: [] as { shift_id: string; dancer_id: string }[], error: null }),
  ]);
  if (aErr || sErr) {
    console.error("taxi-choose-reminders query failed:", aErr ?? sErr);
    return NextResponse.json({ error: "query" }, { status: 500 });
  }

  // Loggen över redan skickade: samma typ, samma kväll i länken.
  const userIds = [...new Set((approvals ?? []).map((a) => a.volunteer_id))];
  const { data: sentRows } = userIds.length
    ? await admin
        .from("notifications")
        .select("user_id, link")
        .eq("type", CHOOSE_REMINDER_TYPE)
        .in("user_id", userIds)
        .gte("created_at", new Date(now.getTime() - 3 * 24 * 3600_000).toISOString())
    : { data: [] as { user_id: string; link: string | null }[] };
  const alreadySent = new Set<string>();
  for (const r of sentRows ?? []) {
    const id = listingIdFromLink(r.link);
    if (id) alreadySent.add(sentKey(r.user_id, id));
  }

  const due = chooseShiftReminders({
    evenings,
    approvals: (approvals ?? []) as ChooseApproval[],
    signups: signups ?? [],
    alreadySent,
    today,
    now,
  });

  let sent = 0;
  for (const d of due) {
    // Avstängd efter tre varningar: då går det inte att boka, så ingen knuff.
    const evening = evenings.find((e) => e.id === d.listingId)!;
    if (strikeStatus(await loadStrikeFacts(d.userId, evening), now).suspendedUntil) continue;
    await createNotification({
      userId: d.userId,
      type: CHOOSE_REMINDER_TYPE,
      titleKey: "volunteerChooseShiftTitle",
      bodyKey: "volunteerChooseShiftMsg",
      params: { title: d.title },
      link: `/app/taxi/${d.listingId}#valj-pass`,
      pushTag: `${CHOOSE_REMINDER_TYPE}:${d.listingId}`,
    }).catch((e) => console.error("volunteer choose-shift notification failed:", e));
    sent++;
  }

  return NextResponse.json({ sent });
}
