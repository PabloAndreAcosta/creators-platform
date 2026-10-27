/**
 * Skuggkörning av lönen: riktiga kvällar + scenarier, räknade både via
 * SAMekonomi och i egen regi. Läser bara. Flyttar inga pengar och skriver
 * ingenting till databasen.
 *
 * Kör:
 *   npx tsx scripts/payroll-shadow.ts > /tmp/skugga.md
 *   ... --creator-percent 50   # kreatörens del av Ushas andel per kväll
 *
 * Rapporten innehåller Ushas intäkter per kväll. Lägg den ALDRIG i repot —
 * det är publikt.
 *
 * Antagandet som bär de riktiga kvällarna: att en kreatör utan bolag tagit
 * `creator-percent` av Ushas andel varje kväll, så som Gizem fick hälften den
 * 1 oktober. Vem som faktiskt höll i vilken kväll står inte i databasen.
 */
import { config } from "dotenv";
config({ path: process.env.ENV_FILE || ".env.local" });

import { createAdminClient } from "@/lib/supabase/admin";
import { splitEventRevenue } from "@/lib/settlements/split";
import { shadowRun, budgetPerPassForAkassa, SAMEKONOMI_FEE_RATE, type ShadowPass } from "@/lib/payroll/shadow";
import { SCENARIOS } from "@/lib/payroll/scenarios";
import { lasStatus } from "@/lib/payroll/las";

const pctIdx = process.argv.indexOf("--creator-percent");
const CREATOR_PERCENT = pctIdx > -1 ? Number(process.argv[pctIdx + 1]) : 50;
const TODAY = new Date().toISOString().slice(0, 10);

const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;

/** Första passet då LAS-räkningen når en nivå, eller null. */
function firstDateAt(passes: readonly ShadowPass[], level: "warn" | "limit"): string | null {
  const dates = passes.map((p) => p.date).sort();
  for (let i = 0; i < dates.length; i++) {
    const s = lasStatus(dates.slice(0, i + 1), dates[i]);
    if (s.level === level || (level === "warn" && s.level === "limit")) return dates[i];
  }
  return null;
}

async function main() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_settlement_payouts")
    .select("gross_ore, refunded_ore, vat_rate, partner_percent, listing:listings(title, event_date)")
    .order("created_at");
  if (error) throw error;

  const nights = (data ?? []).map((r) => {
    const listing = Array.isArray(r.listing) ? r.listing[0] : r.listing;
    const at = (vatRate: number) =>
      splitEventRevenue({
        grossOre: r.gross_ore,
        refundedOre: r.refunded_ore ?? 0,
        vatRate,
        partnerPercent: r.partner_percent,
      });
    const now = at(r.vat_rate);
    const low = at(0.06);
    return {
      date: String(listing?.event_date ?? "").slice(0, 10),
      title: String(listing?.title ?? "okänd kväll"),
      vatRate: r.vat_rate,
      grossOre: r.gross_ore,
      budgetOre: Math.floor((now.organiserOre * CREATOR_PERCENT) / 100),
      budgetAt6Ore: Math.floor((low.organiserOre * CREATOR_PERCENT) / 100),
    };
  });

  const out: string[] = [];
  out.push(`# Skuggkörning lön — ${TODAY}`, "");
  out.push(
    `Läser bara. Inga pengar flyttas. Kreatören antas ta ${CREATOR_PERCENT} % av Ushas andel per kväll.`,
    `SAMekonomi räknas som ${SAMEKONOMI_FEE_RATE * 100} % avgift följt av samma lönemotor.`,
    "",
  );

  // ── Riktiga kvällar ───────────────────────────────────────────────────
  const real = shadowRun(
    { birthYear: 1990 },
    nights.map((n) => ({ date: n.date, labourBudgetOre: n.budgetOre })),
    TODAY,
  );
  const realLow = shadowRun(
    { birthYear: 1990 },
    nights.map((n) => ({ date: n.date, labourBudgetOre: n.budgetAt6Ore })),
    TODAY,
  );
  out.push(`## A. Riktiga kvällar (${nights.length} st)`, "");
  out.push("| Kväll | Biljetter | Kreatörens andel | Netto via SAM | Netto egen regi | Netto om entrémoms 6 % |");
  out.push("|---|---|---|---|---|---|");
  nights.forEach((n, i) => {
    out.push(
      `| ${n.date} ${n.title.replace(/ –.*/, "")} | ${kr(n.grossOre)} | ${kr(n.budgetOre)} | ${kr(real.lines[i].samekonomi.netOre)} | ${kr(real.lines[i].ownRegime.netOre)} | ${kr(realLow.lines[i].ownRegime.netOre)} |`,
    );
  });
  out.push(
    `| **Summa** | | ${kr(real.totals.budgetOre)} | ${kr(real.totals.samNetOre)} | ${kr(real.totals.ownNetOre)} | ${kr(realLow.totals.ownNetOre)} |`,
    "",
  );
  out.push("Per månad, egen regi (det AGI och skattekontot skulle visa):", "");
  out.push("| Månad | Pass | Bruttolön | Arbetsgivaravgift | Skatteavdrag | Till skattekontot senast den 12:e | Avgift till SAM | Når 11 000 kr? |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const m of real.months) {
    out.push(
      `| ${m.month} | ${m.passes} | ${kr(m.ownGrossOre)} | ${kr(m.ownEmployerFeeOre)} | ${kr(m.ownWithholdingOre)} | ${kr(m.ownTaxAccountOre)} | ${kr(m.samFeeOre)} | ${m.reachesAkassaMonth ? "ja" : "nej"} |`,
    );
  }
  out.push("", `LAS om samma person hållit i alla kvällar: ${real.las.days} dagar räknade, ${real.las.daysLeft} kvar till gränsen.`, "");

  // ── Scenarier ─────────────────────────────────────────────────────────
  out.push("## B. Scenarier", "");
  for (const s of SCENARIOS) {
    const r = shadowRun(s.creator, s.passes, s.today, s);
    const first = r.lines[0];
    out.push(`### ${s.title}`, "", `*${s.question}*`, "");
    out.push(
      `- Pass: ${r.lines.length}, andel totalt ${kr(r.totals.budgetOre)}`,
      `- Netto via SAMekonomi: ${kr(r.totals.samNetOre)} (avgift ${kr(r.totals.samFeeOre)})`,
      `- Netto egen regi: ${kr(r.totals.ownNetOre)}`,
      `- Första passet: brutto ${kr(first.ownRegime.grossOre)}, arbetsgivaravgift ${kr(first.ownRegime.employerFeeOre)} (${first.ownRegime.feeBasis}), skatt ${kr(first.ownRegime.withholdingOre)}, netto ${kr(first.ownRegime.netOre)}`,
    );
    if (s.key === "varje-torsdag") {
      out.push(
        `- LAS-varning (60 dagar kvar) vid passet ${firstDateAt(s.passes, "warn")}, gränsen passeras ${firstDateAt(s.passes, "limit")}`,
        `- ${r.lines.filter((l) => l.projected).length} pass räknade med 2026 års satser (2027 saknas än)`,
      );
    }
    if (s.key === "sen-aterbetalning") {
      out.push(
        `- Kvittat mot pass 2: ${kr(r.lines[1].debtDeductedOre)}. Under veckan däremellan står Usha för hela beloppet.`,
      );
    }
    out.push("");
  }

  // ── A-kassan ──────────────────────────────────────────────────────────
  out.push("## C. Vad krävs för att en månad ska räknas mot a-kassan (11 000 kr brutto)?", "");
  out.push("| Pass i månaden | Kreatörens andel per pass |", "|---|---|");
  for (const n of [4, 8, 12, 16]) {
    out.push(`| ${n} | ${kr(budgetPerPassForAkassa(1990, "2026-11-25", n))} |`);
  }
  out.push("");
  process.stdout.write(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
