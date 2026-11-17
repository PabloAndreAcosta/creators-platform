import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { getResend, getFromEmail } from "@/lib/email/resend";
import { createClient } from "@supabase/supabase-js";
import { adoptGuestBookings } from "@/lib/bookings/adopt-guest";
import { isEmailProven } from "@/lib/auth/email-proven";
import {
  granskaKvall,
  sortera,
  type Avvikelse,
  type KvallInput,
} from "@/lib/health/weekly-check";

/**
 * Veckokontroll. Letar efter drift och hör av sig bara när den hittar något.
 *
 * Se lib/health/weekly-check.ts för vad den letar efter och varför.
 */

// Lika med LEAD_DAYS i cron/event-reminders: appen publicerar kvällens
// Facebook-inlägg tre dagar före. Inom det fönstret SKA inlägget finnas, så
// saknas det där har publiceringen fallerat. Längre fram är det bara för tidigt
// — med 21 dagar larmade kontrollen varje vecka om kvällar som skulle publiceras
// helt enligt plan.
const HORISONT_DAGAR = 3;

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function recipients(): string[] {
  const raw = process.env.PLATFORM_SALE_ALERT_TO || "pablo.acosta@usha.se";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const idag = new Date().toISOString().slice(0, 10);

  const { data: listings } = await admin
    .from("listings")
    .select("id, slug, title, event_date, is_active, price, facebook_event_id, user_id")
    .gte("event_date", idag)
    .eq("is_active", true);

  const ids = (listings ?? []).map((l) => l.id);
  const { data: types } = ids.length
    ? await admin.from("ticket_types").select("listing_id").in("listing_id", ids)
    : { data: [] as { listing_id: string }[] };

  const antalTyper = new Map<string, number>();
  for (const t of types ?? []) {
    antalTyper.set(t.listing_id, (antalTyper.get(t.listing_id) ?? 0) + 1);
  }

  // Modell A: kvällar med en intäktsdelning mot en lokal.
  const { data: shares } = ids.length
    ? await admin.from("event_revenue_shares").select("listing_id").in("listing_id", ids)
    : { data: [] as { listing_id: string }[] };
  const medIntaktsdelning = new Set((shares ?? []).map((s) => s.listing_id));

  // Modell B: säljaren är någon annan än Usha, alltså tas provision.
  // is_usha_owned_seller avgör flödet; allt annat är tredjepartsförsäljning.
  const agarIds = [...new Set((listings ?? []).map((l) => l.user_id).filter(Boolean))];
  const { data: agare } = agarIds.length
    ? await admin.from("profiles").select("id, is_usha_owned_seller").in("id", agarIds)
    : { data: [] as { id: string; is_usha_owned_seller: boolean | null }[] };
  const ushaSaljare = new Set(
    (agare ?? []).filter((p) => p.is_usha_owned_seller).map((p) => p.id)
  );

  const avvikelser: Avvikelse[] = [];
  for (const l of listings ?? []) {
    const k: KvallInput = {
      id: l.id,
      slug: l.slug,
      title: l.title,
      eventDate: l.event_date,
      isActive: l.is_active,
      price: l.price,
      facebookEventId: l.facebook_event_id,
      ticketTypeCount: antalTyper.get(l.id) ?? 0,
      harIntaktsdelning: medIntaktsdelning.has(l.id),
      saljsAvTredjepart: !ushaSaljare.has(l.user_id),
    };
    avvikelser.push(...granskaKvall(k, idag, HORISONT_DAGAR));
  }

  // Gästköp vars mejladress matchar ett konto. Adoptionen sker vid inloggning,
  // så den som köpte som gäst och sedan inte loggar in blir aldrig knuten till
  // sitt konto. Kontrollen gör därför samma adoption själv — men bara för konton
  // som BEVISAT att de äger adressen (isEmailProven), exakt som vid inloggning.
  // Övriga rörs inte och larmas inte om: det finns inget att göra förrän
  // personen själv bevisar adressen, och ett larm som inte går att åtgärda
  // lär bara mottagaren att sluta läsa.
  let adopterade = 0;
  const { data: gastRader } = await admin
    .from("bookings")
    .select("guest_email")
    .is("customer_id", null)
    .not("guest_email", "is", null);
  const gastMejl = new Set(
    (gastRader ?? []).map((b) => (b.guest_email ?? "").trim().toLowerCase()).filter(Boolean)
  );
  if (gastMejl.size) {
    const { data: profiler } = await admin.from("profiles").select("id").in("email", [...gastMejl]);
    for (const p of profiler ?? []) {
      const { data } = await admin.auth.admin.getUserById(p.id);
      if (!data?.user) continue;
      adopterade += await adoptGuestBookings(admin, p.id, data.user.email, {
        emailProven: isEmailProven(data.user),
      });
    }
  }

  const sorterade = sortera(avvikelser);

  // Tystnad när allt är som det ska. Ett veckomejl som alltid kommer slutar
  // läsas, och då är nästa riktiga avvikelse osynlig.
  if (sorterade.length === 0) {
    return NextResponse.json({ ok: true, avvikelser: 0, adopterade, mejl: "inget" });
  }

  const rader = sorterade
    .map(
      (a) =>
        `<tr><td style="padding:6px 10px">${a.allvar === "blockerar" ? "🔴" : "🟡"}</td>` +
        `<td style="padding:6px 10px">${esc(a.kvall)}</td>` +
        `<td style="padding:6px 10px">${esc(a.detalj)}</td></tr>`
    )
    .join("");

  const blockerande = sorterade.filter((a) => a.allvar === "blockerar").length;

  try {
    const resend = getResend();
    if (resend) {
      await resend.emails.send({
        from: getFromEmail(),
        to: recipients(),
        subject:
          blockerande > 0
            ? `Veckokontroll: ${blockerande} sak(er) blockerar försäljning`
            : `Veckokontroll: ${sorterade.length} sak(er) att titta på`,
        html:
          `<p>Kontrollen hittade ${sorterade.length} avvikelse(r). Rött blockerar försäljning, gult bör rättas.</p>` +
          `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${rader}</table>` +
          `<p style="color:#666;font-size:12px">Du får det här mejlet bara när något avviker.</p>`,
      });
    }
  } catch (e) {
    // Mejlet får inte fälla jobbet — avvikelserna syns ändå i svaret och loggen.
    console.error("Veckokontroll: mejlet gick inte fram", e);
  }

  return NextResponse.json({ ok: true, avvikelser: sorterade.length, blockerande, adopterade, detaljer: sorterade });
}
