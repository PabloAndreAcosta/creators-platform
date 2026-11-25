import { describe, it, expect } from "vitest";
import sv from "@/i18n/messages/sv.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import STATIC_TEXTS from "../static-texts.json";
import { ERROR_PAGE_KEYS, FEEDBACK_KEYS } from "../texts";

/**
 * global-error läser static-texts.json eftersom den saknar IntlProvider. Den
 * filen får aldrig glida isär från språkfilerna, och nyckellistorna i texts.ts
 * måste täcka exakt det som finns.
 */
const MESSAGES = { sv, en, es } as Record<string, Record<string, unknown>>;

describe("felknappens texter", () => {
  for (const locale of ["sv", "en", "es"] as const) {
    it(`${locale}: static-texts.json = språkfilen`, () => {
      expect(STATIC_TEXTS[locale].feedback).toEqual(MESSAGES[locale].feedback);
      expect(STATIC_TEXTS[locale].errorPage).toEqual(MESSAGES[locale].errorPage);
    });

    it(`${locale}: nyckellistorna stämmer`, () => {
      expect(Object.keys(STATIC_TEXTS[locale].feedback).sort()).toEqual([...FEEDBACK_KEYS].sort());
      expect(Object.keys(STATIC_TEXTS[locale].errorPage).sort()).toEqual([...ERROR_PAGE_KEYS].sort());
    });
  }

  it("integritetstexten är den Pablo godkände", () => {
    expect(STATIC_TEXTS.sv.feedback.notice).toBe(
      "Din beskrivning och teknisk info om sidan skickas till Usha via Sentry (EU).",
    );
    expect(STATIC_TEXTS.sv.feedback.thanks).toBe("Tack! Vi tittar på det.");
    expect(STATIC_TEXTS.sv.feedback.button).toBe("Något fungerar inte?");
  });
});
