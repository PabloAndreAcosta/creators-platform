import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { runSettlementSupplements } from "@/lib/settlements/run-supplements";
import { KOMPLETTERING_FONSTER_DAGAR } from "@/lib/settlements/supplement";
import { getResend, getFromEmail } from "@/lib/email/resend";

/**
 * Cron: för över mellanskillnaden för kvällar som ändrats efter avräkningen.
 *
 * Den vanliga avräkningen körs en gång och låser raden som "paid". Allt som
 * ändrar kvällens intäkt efter det — en sen betalning, ett efterregistrerat
 * klipp, en biljett som flyttas hit — nådde tidigare aldrig partnern.
 *
 * Jobbet ska köras EFTER settlement-payouts samma natt, så att en kväll först
 * får sin ordinarie avräkning och först därefter kan kompletteras.
 *
 * Samma spärr som den ordinarie körningen: inga pengar rör sig förrän
 * SETTLEMENT_PAYOUTS_ENABLED=true. Dessförinnan skrivs rader med status
 * "dry_run" så att beloppen går att granska innan det blir skarpt.
 */

function recipients(): string[] {
  const raw = process.env.PLATFORM_SALE_ALERT_TO || "pablo.acosta@usha.se";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const kr = (ore: number) => `${(ore / 100).toFixed(2)} kr`;

function esc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSettlementSupplements();

    console.log(
      `[settlement-supplements] ${result.today} live=${result.live} ` +
        `betalda=${result.paid} torrkörda=${result.dryRun} omräknade=${result.dryRunUpdated} ` +
        `i_balans=${result.balanced} ` +
        `överbetalda=${result.overpaid.length} blockerade=${result.blocked.length} ` +
        `uppskjutna=${result.deferred.length} misslyckade=${result.failed.length} ` +
        `summa=${(result.totalOre / 100).toFixed(2)} kr`
    );
    for (const o of result.overpaid)
      console.warn(`[settlement-supplements] ÖVERBETALD ${o.title} ${o.eventDate}: ${kr(o.excessOre)} för mycket`);
    for (const b of result.blocked) console.log(`[settlement-supplements] blockerad ${b.title}: ${b.reason}`);
    for (const f of result.failed) console.error(`[settlement-supplements] MISSLYCKAD ${f.title}: ${f.error}`);

    // Beskedet går bara när något faktiskt hänt. En natt där alla kvällar är i
    // balans är det normala och ska vara tyst — ett mejl varje natt slutar
    // läsas, och då missas det som betyder något.
    // En rad som bara räknats om (dryRunUpdated) ger medvetet inget besked.
    // Den mellanskillnaden är redan rapporterad en gång, och så länge
    // utbetalningarna är avstängda skulle den annars mejlas varje timme.
    const nagotHarHant =
      result.transfers.length > 0 ||
      result.dryRun > 0 ||
      result.failed.length > 0 ||
      result.overpaid.length > 0 ||
      result.blocked.length > 0;

    if (nagotHarHant) {
      const rader = [
        ...result.transfers.map(
          (t) =>
            `<tr><td style="padding:6px 10px;white-space:nowrap">${esc(t.eventDate)}</td>` +
            `<td style="padding:6px 10px">${esc(t.title)}</td>` +
            `<td style="padding:6px 10px">${esc(t.partnerName)}</td>` +
            `<td style="padding:6px 10px;text-align:right;white-space:nowrap">${kr(t.amountOre)}</td>` +
            `<td style="padding:6px 10px;color:#666;font-size:12px">${esc(t.transferId)}<br>` +
            `${esc(t.destinationAccountId ?? "okänt konto")}</td></tr>`
        ),
        ...result.overpaid.map(
          (o) =>
            `<tr style="color:#b26a00"><td style="padding:6px 10px;white-space:nowrap">${esc(o.eventDate)}</td>` +
            `<td style="padding:6px 10px">${esc(o.title)}</td>` +
            `<td colspan="3" style="padding:6px 10px">FÖR MYCKET UTBETALT: ${kr(o.excessOre)}. ` +
            `Rättas inte automatiskt — pengar dras aldrig tillbaka av ett nattjobb.</td></tr>`
        ),
        ...result.blocked.map(
          (b) =>
            `<tr style="color:#666"><td style="padding:6px 10px">—</td>` +
            `<td style="padding:6px 10px">${esc(b.title)}</td>` +
            `<td colspan="3" style="padding:6px 10px">väntar: ${esc(b.reason)}</td></tr>`
        ),
        ...result.failed.map(
          (f) =>
            `<tr style="color:#b00"><td style="padding:6px 10px">—</td>` +
            `<td style="padding:6px 10px">${esc(f.title)}</td>` +
            `<td colspan="3" style="padding:6px 10px">MISSLYCKADES: ${esc(f.error)}</td></tr>`
        ),
      ].join("");

      const summa = result.transfers.reduce((n, t) => n + t.amountOre, 0);
      const rubrik =
        result.failed.length > 0
          ? `Usha: komplettering med ${result.failed.length} misslyckad${result.failed.length === 1 ? "" : "e"}`
          : result.overpaid.length > 0
            ? `Usha: ${result.overpaid.length} kväll${result.overpaid.length === 1 ? "" : "ar"} med för mycket utbetalt`
            : `Usha: ${kr(summa)} i kompletterande avräkning`;

      const { error: mailError } = await getResend().emails.send({
        from: getFromEmail(),
        to: recipients(),
        subject: rubrik,
        html:
          `<h2>Kompletterande avräkning ${esc(result.today)}</h2>` +
          `<p>Kvällar vars intäkt ändrats efter att avräkningen redan betalats. ` +
          `${result.transfers.length} efterbetalning${result.transfers.length === 1 ? "" : "ar"}, ` +
          `totalt <strong>${kr(summa)}</strong>.</p>` +
          `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${rader}</table>` +
          `<p style="color:#666;font-size:12px">Beloppet är skillnaden mellan vad partnern ska ha nu och ` +
          `vad som redan förts över — aldrig hela andelen en gång till. ` +
          `Kvällar äldre än ${KOMPLETTERING_FONSTER_DAGAR} dagar lämnas åt handpåläggning.</p>`,
      });

      if (mailError) console.error("[settlement-supplements] kunde inte skicka besked:", mailError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[settlement-supplements] körningen kraschade:", error);
    return NextResponse.json({ error: "Settlement supplement run failed" }, { status: 500 });
  }
}
