import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import sv from "@/i18n/messages/sv.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import { TERMS_S7_BUSINESS_EFFECTIVE_DATE } from "./terms-effective";

const LOCALES = { sv, en, es } as const;

// Fras som inleder ikraftträdandemeningen för näringsidkare i s7 (P2B art. 3.2).
const EFFECTIVE_PHRASE = {
  sv: "Gäller för näringsidkare från och med",
  en: "Applies to businesses (traders) from",
  es: "Se aplica a los empresarios a partir del",
} as const;

describe("villkoren punkt 7: ikraftträdande för näringsidkare", () => {
  for (const [locale, messages] of Object.entries(LOCALES) as [keyof typeof LOCALES, typeof sv][]) {
    it(`${locale}: datumet sätts in och det tidigare taket står kvar fram till dess`, () => {
      const t = createTranslator({ locale, messages, namespace: "terms" });
      const body = t("s7Body", { date: "2026-12-15" });
      expect(body).toContain(`${EFFECTIVE_PHRASE[locale]} 2026-12-15`);
      expect(body).not.toContain("{date}");
      // Det tidigare taket (betalt till Usha senaste 12 månaderna) gäller fram till datumet.
      expect(body).toMatch(/12/);
      // Det nya taket för näringsidkare.
      expect(body).toMatch(/5[  .,]?000/);
    });

    it(`${locale}: s2, s5 och refundPolicy formateras utan platshållare`, () => {
      const terms = createTranslator({ locale, messages, namespace: "terms" });
      for (const k of ["s2Body", "s5Body"] as const) {
        const s = terms(k);
        expect(s).not.toMatch(/[{}]/);
        expect(s.length).toBeGreaterThan(200);
      }
      const refund = createTranslator({ locale, messages, namespace: "refundPolicy" });
      for (const k of Object.keys(messages.refundPolicy) as (keyof typeof messages.refundPolicy)[]) {
        expect(refund(k)).not.toMatch(/[{}]/);
      }
      expect(terms("lastUpdated")).toContain("2026");
      expect(refund("lastUpdated")).toBe(terms("lastUpdated"));
    });
  }

  it("datumet är en platshållare eller ett ÅÅÅÅ-MM-DD-datum", () => {
    expect(TERMS_S7_BUSINESS_EFFECTIVE_DATE).toMatch(/^(\[DATUM\]|\d{4}-\d{2}-\d{2})$/);
  });
});
