import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { COMMISSION_RATES, PLATFORM_COMMISSION } from "@/lib/stripe/commission";
import { PLANS, getPlanList } from "@/lib/stripe/config";

/**
 * Landningssidorna får inte lova något plattformen inte gör.
 *
 * Bakgrund: sidorna sålde i månader Publik Guld (199 kr/mån), Publik Premium
 * (499), Venue Guld (299) och Venue Premium (599) — nivåer som avvecklades —
 * och räknade upp fyra förmåner som aldrig fanns byggda (VIP utan kö,
 * exklusivt innehåll, prioriterad support, toppsynlighet). Biljettsidan
 * prissatte dessutom en serviceavgift som är avstängd och aldrig tagits ut.
 *
 * Ingen av de sakerna fångades av något test, för prislistan bor på tre
 * ställen: PLANS i koden, prisrutorna på landningssidan och biljettsidans egen
 * text. De här testerna binder ihop dem så att nästa ändring i koden tvingar
 * fram ändringen i texten.
 */

const DIR = join(process.cwd(), "src/i18n/messages");
const LOCALES = ["sv", "en", "es"] as const;
const msgs = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(join(DIR, `${l}.json`), "utf8"))])
) as Record<(typeof LOCALES)[number], Record<string, never>>;

/** Alla strängvärden under en nyckelväg, oavsett hur djupt de ligger. */
function varden(root: unknown, vag: string): string[] {
  let node: unknown = root;
  for (const del of vag ? vag.split(".") : []) node = (node as Record<string, unknown>)?.[del];
  const ut: string[] = [];
  (function walk(o: unknown) {
    if (typeof o === "string") ut.push(o);
    else if (o && typeof o === "object") Object.values(o).forEach(walk);
  })(node);
  return ut;
}

/** Procenttal tål både "8 %" och "8%", och engelskans/spanskans varianter. */
// Flyttal: 0.035 * 100 blir 3.5000000000000004, så talet avrundas först.
const procent = (n: number) => new RegExp(`\\b${Number(n.toFixed(2))}\\s?%`);

describe("prisrutorna på landningssidan", () => {
  it("innehåller inga nycklar för avvecklade nivåer", () => {
    // Ligger de kvar i filen är de bara ett klipp-och-klistra från att hamna
    // på sidan igen.
    const dodaPrefix = ["publikGold", "publikPremium", "upplevelseGold", "upplevelsePremium", "kreatorGold", "kreatorPremium", "kreatorFree", "gold", "premium", "ctaGold", "ctaPremium", "mostPopular", "beta", "sekMonth", "freeDuringBeta"];
    for (const l of LOCALES) {
      const nycklar = Object.keys((msgs[l] as never as Record<string, Record<string, object>>).landing.pricing);
      const kvar = nycklar.filter((k) => dodaPrefix.some((p) => k.startsWith(p)));
      expect(kvar, `${l}.json`).toEqual([]);
    }
  });

  it("har ingen prisstege alls — en nivå sedan 2026-11-13", () => {
    // Skulle någon roll få en köpbar nivå igen ska det här testet falla,
    // inte sidan tiga.
    const roller = new Set(getPlanList().map((p) => PLANS[p.key].role));
    expect([...roller]).toEqual([]);
  });

  it("uppger samma provision som COMMISSION_RATES", () => {
    const rad = (nyckel: string) => varden(msgs.sv, `landing.pricing.${nyckel}`).join(" ");
    expect(rad("kreatorOne2")).toMatch(procent(COMMISSION_RATES.gratis * 100));
    // Samma sats för alla: står det något annat än gratisnivåns procent
    // någonstans i prisrutorna är det en gammal stege som smugit tillbaka.
    expect(COMMISSION_RATES.guld).toBe(COMMISSION_RATES.gratis);
    expect(COMMISSION_RATES.premium).toBe(COMMISSION_RATES.gratis);
    // Och ingenstans den gamla 15-procentaren.
    const allt = varden(msgs.sv, "landing.pricing");
    expect(allt.some((v) => procent(15).test(v))).toBe(false);
  });
});

describe("biljettsidan", () => {
  it("prissätter provisionen med både procent och fast del", () => {
    // Sedan 2026-11-13: 3,5 % + 3,50 kr per biljett. Serviceavgiften för
    // köparen är arrangörens val per event och får nämnas som just det —
    // men priset som skyltas är provisionen.
    const pris = varden(msgs.sv, "sellTickets.pricingAmount").join(" ");
    expect(pris).toMatch(procent(PLATFORM_COMMISSION.rate * 100));
    expect(pris).toContain((PLATFORM_COMMISSION.fixedOre / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 }));
    // Och den gamla platta satsen ska inte stå kvar någonstans på sidan.
    for (const l of LOCALES) {
      const text = varden(msgs[l], "sellTickets").join(" ");
      expect(text, `${l}.json`).not.toMatch(/\b8\s?%/);
    }
  });

  it("lovar inte att pengarna går direkt till kreatörens Stripe-konto", () => {
    // Påståendet stämmer inte för de flesta säljare. card_payments är aktiv
    // på två av fem anslutna konton (Pablos kreatörskonto och Bacchi Syre);
    // för övriga tar Usha emot betalningen och för över säljarens del efteråt.
    // Och även MED kapaciteten är det ett MoR-skifte via on_behalf_of, inte
    // en betalning som landar direkt hos säljaren. En sida kan inte lova
    // något som beror på ett KYC-steg mottagaren kanske inte gjort.
    //
    // Kontrollen går över HELA språkfilen: påståendet stod på både
    // biljettsidan och taxidansarsidan, och nästa gång ska det inte spela
    // någon roll var det dyker upp.
    for (const l of LOCALES) {
      const text = varden(msgs[l], "").join(" ").toLowerCase();
      for (const fras of [
        "direkt till ditt stripe",
        "går direkt till dansaren",
        "straight to your stripe",
        "directly to your stripe",
        "directamente a tu cuenta de stripe",
      ]) {
        expect(text, `${l}.json`).not.toContain(fras);
      }
    }
  });
});

describe("appens egna ytor", () => {
  it("erbjuder inte publiken eller lokaler en nivå de inte kan teckna", () => {
    // Publikhemmet visade "Bli Guld-medlem" och en ruta med rabatt, förtur
    // och prioritetskö. Nivåerna är avvecklade och två av förmånerna fanns
    // aldrig. Nycklarna är borta; ligger de kvar är de ett klick från att
    // renderas igen.
    const doda = [
      "exclusiveForYou",
      "bookingDiscount",
      "neverInQueue",
      "prioritySupport",
      "upgradeToPremium",
      "premiumBenefits",
      "becomeGold",
      "goldBenefits",
    ];
    for (const l of LOCALES) {
      const home = (msgs[l] as never as Record<string, Record<string, unknown>>).home;
      expect(doda.filter((k) => k in home), `${l}.json`).toEqual([]);
    }
  });

  it("välkomstmejlet bär ingen egen förmånslista", () => {
    // Den ska komma från nivån. Se lib/email/plan-benefits.ts.
    for (const l of LOCALES) {
      const emails = (msgs[l] as never as Record<string, Record<string, unknown>>).emails;
      const kvar = Object.keys(emails).filter((k) => k.startsWith("goldBenefit"));
      expect(kvar, `${l}.json`).toEqual([]);
    }
  });
});
