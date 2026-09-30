import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { COMMISSION_RATES } from "@/lib/stripe/commission";
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
const procent = (n: number) => new RegExp(`\\b${n}\\s?%`);

describe("prisrutorna på landningssidan", () => {
  it("innehåller inga nycklar för avvecklade nivåer", () => {
    // Ligger de kvar i filen är de bara ett klipp-och-klistra från att hamna
    // på sidan igen.
    const dodaPrefix = ["publikGold", "publikPremium", "upplevelseGold", "upplevelsePremium"];
    for (const l of LOCALES) {
      const nycklar = Object.keys((msgs[l] as never as Record<string, Record<string, object>>).landing.pricing);
      const kvar = nycklar.filter((k) => dodaPrefix.some((p) => k.startsWith(p)));
      expect(kvar, `${l}.json`).toEqual([]);
    }
  });

  it("har bara en prisstege för de roller som faktiskt kan teckna en", () => {
    // Kreatören är den enda rollen med en köpbar nivå kvar. Skulle en ny roll
    // få en nivå ska det här testet falla, inte sidan tiga.
    const roller = new Set(getPlanList().map((p) => PLANS[p.key].role));
    expect([...roller]).toEqual(["creator"]);
  });

  it("uppger samma provision som COMMISSION_RATES", () => {
    const rad = (nyckel: string) => varden(msgs.sv, `landing.pricing.${nyckel}`).join(" ");
    expect(rad("kreatorFree2")).toMatch(procent(COMMISSION_RATES.gratis * 100));
    expect(rad("kreatorGold2")).toMatch(procent(COMMISSION_RATES.guld * 100));
    expect(rad("kreatorPremium2")).toMatch(procent(COMMISSION_RATES.premium * 100));
    // Och ingenstans den gamla 15-procentaren.
    const allt = varden(msgs.sv, "landing.pricing");
    expect(allt.some((v) => procent(15).test(v))).toBe(false);
  });
});

describe("biljettsidan", () => {
  it("prissätter provisionen, inte den avstängda serviceavgiften", () => {
    // NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED är inte satt i produktion, så
    // serviceavgiften har aldrig tagits ut. Att ändå skylta med den som pris
    // var det enskilt farligaste påståendet på sajten.
    const avgiftPa = process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED === "true";
    if (avgiftPa) return;
    expect(varden(msgs.sv, "sellTickets.pricingAmount").join(" ")).toMatch(
      procent(COMMISSION_RATES.gratis * 100)
    );
    for (const l of LOCALES) {
      const text = varden(msgs[l], "sellTickets").join(" ").toLowerCase();
      for (const ord of ["serviceavgift", "service fee", "tarifa de servicio"]) {
        expect(text, `${l}.json nämner ${ord}`).not.toContain(ord);
      }
    }
  });

  it("lovar inte att pengarna går direkt till kreatörens Stripe-konto", () => {
    // card_payments har aldrig beviljats på något connected account. Usha tar
    // emot betalningen och för över säljarens del efteråt — pengarna kommer
    // fram, men inte på det sätt texten påstod. Kontrollen går över HELA
    // språkfilen: påståendet stod på både biljettsidan och taxidansarsidan,
    // och nästa gång ska det inte spela någon roll var det dyker upp.
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
