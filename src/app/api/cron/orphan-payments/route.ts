import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, getFromEmail } from "@/lib/email/resend";
import {
  orphanCandidates,
  missingBookings,
  osedda,
  uppdateradHistorik,
  MOGNAD_SEKUNDER,
  type ChargeLike,
} from "@/lib/tickets/orphan-payments";

/**
 * Cron: betalningar som inte blivit biljetter.
 *
 * Den enda kontrollen som ser från PENGARNA till biljetten. Allt annat vi
 * mäter utgår från våra egna rader, och en rad som aldrig skapades syns inte
 * i dem — gästen har betalat, Stripe har pengarna, och hos oss finns ingenting.
 *
 * Körs varje timme. En gäst som betalat och inte fått någon biljett står ofta
 * kvar i dörren, så ett dygns fördröjning vore meningslöst.
 */

const HISTORIK_KEY = "orphan_payments_larmade";
const FONSTER_TIMMAR = 48;

function recipients(): string[] {
  const raw = process.env.PLATFORM_SALE_ALERT_TO || "pablo.acosta@usha.se";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const kr = (ore: number) => `${(ore / 100).toFixed(2)} kr`;
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();

    const charges = await stripe.charges.list({
      created: { gt: Math.floor(now.getTime() / 1000) - FONSTER_TIMMAR * 3600 },
      limit: 100,
    });

    const kandidater = orphanCandidates(charges.data as unknown as ChargeLike[], now);
    if (kandidater.length === 0) {
      return NextResponse.json({ checked: true, candidates: 0, orphans: 0 });
    }

    // Bokningarna som hör till kandidaterna. Matchning på payment_intent,
    // eftersom det är det bookings.stripe_payment_id bär.
    const intents = kandidater.map((c) => c.payment_intent).filter(Boolean) as string[];
    const { data: bokningar } = await admin
      .from("bookings")
      .select("stripe_payment_id")
      .in("stripe_payment_id", intents);

    const kanda = new Set(
      ((bokningar as { stripe_payment_id: string | null }[] | null) ?? [])
        .map((b) => b.stripe_payment_id)
        .filter(Boolean) as string[]
    );

    const saknade = missingBookings(kandidater, kanda);

    // Vad vi redan larmat om. Utan den här skulle samma betalning mejlas varje
    // timme tills någon rättade den, och ett larm som upprepas slutar läsas.
    const { data: rad } = await admin
      .from("app_config")
      .select("value")
      .eq("key", HISTORIK_KEY)
      .maybeSingle();
    const redanLarmade = ((rad?.value as { ids?: string[] } | null)?.ids ?? []) as string[];

    const nya = osedda(saknade, redanLarmade);

    console.log(
      `[orphan-payments] kandidater=${kandidater.length} saknar_bokning=${saknade.length} nya=${nya.length}`
    );

    if (nya.length === 0) {
      return NextResponse.json({
        checked: true,
        candidates: kandidater.length,
        orphans: saknade.length,
        new: 0,
      });
    }

    const rader = nya
      .map(
        (c) =>
          `<tr>` +
          `<td style="padding:6px 10px;white-space:nowrap">${esc(
            new Date(c.created * 1000).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })
          )}</td>` +
          `<td style="padding:6px 10px;text-align:right;white-space:nowrap">${kr(c.amount)}</td>` +
          `<td style="padding:6px 10px;font-family:monospace;font-size:12px">${esc(c.id)}<br>` +
          `${esc(c.payment_intent ?? "saknar payment_intent")}</td>` +
          `<td style="padding:6px 10px;font-family:monospace;font-size:12px">${esc(
            c.metadata?.event_id ?? ""
          )}</td></tr>`
      )
      .join("");

    const { error: mailError } = await getResend().emails.send({
      from: getFromEmail(),
      to: recipients(),
      subject: `Usha: ${nya.length} betalning${nya.length === 1 ? "" : "ar"} utan biljett`,
      html:
        `<h2>Betalt men ingen biljett</h2>` +
        `<p>Stripe har tagit emot ${nya.length} betalning${nya.length === 1 ? "" : "ar"} ` +
        `för en kväll, men det finns ingen bokning hos oss. Gästen har alltså betalat ` +
        `och fått <strong>varken biljett eller mejl</strong>.</p>` +
        `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${rader}</table>` +
        `<p style="color:#666;font-size:12px">` +
        `Kontrollen går från betalningen till biljetten och inte tvärtom, så den ser ` +
        `det som saknas helt. Betalningar yngre än ${MOGNAD_SEKUNDER / 60} minuter ` +
        `lämnas i fred — webhooken är inte synkron. Varje betalning larmas en gång.</p>` +
        `<p style="color:#666;font-size:12px">Att göra: slå upp betalningen i Stripe, ` +
        `kontakta gästen, och lägg biljetten för hand. Återkommer det är det webhooken ` +
        `som brister, inte den enskilda betalningen.</p>`,
    });

    if (mailError) console.error("[orphan-payments] kunde inte larma:", mailError);

    await admin.from("app_config").upsert(
      { key: HISTORIK_KEY, value: { ids: uppdateradHistorik(redanLarmade, nya) } },
      { onConflict: "key" }
    );

    return NextResponse.json({
      checked: true,
      candidates: kandidater.length,
      orphans: saknade.length,
      new: nya.length,
    });
  } catch (error) {
    console.error("[orphan-payments] körningen kraschade:", error);
    return NextResponse.json({ error: "Orphan payment check failed" }, { status: 500 });
  }
}
