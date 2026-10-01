import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { readFileSync } from "fs";
import { join } from "path";
import BookingConfirmation from "@/components/emails/BookingConfirmation";
import type { Translate } from "@/lib/i18n/server";
import type { Locale } from "@/i18n/config";

/**
 * Kvittot måste bära beloppet.
 *
 * Det gjorde det inte förrän 2026-10-01: bekräftelsen hade tjänst, datum,
 * säljare, org.nr och momsnotering — men ingenstans vad kunden betalat. Ett
 * kvitto utan summa går inte att lämna in till en arbetsgivare för
 * friskvårdsersättning, och duger inte som underlag vid en reklamation.
 */

const SELLER = { name: "Usha AB", orgNumber: "559401-8326", vatNote: "Moms ingår i priset." };

function t(locale: Locale): Translate {
  const messages = JSON.parse(readFileSync(join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8"));
  return createTranslator({ locale, messages, namespace: "emails" }) as unknown as Translate;
}

function render(amountOre: number | null | undefined, locale: Locale = "sv") {
  return renderToStaticMarkup(
    createElement(BookingConfirmation, {
      customerName: "Pau",
      serviceName: "The Lab",
      scheduledAt: new Date("2026-10-01T17:00:00Z"),
      creatorName: "Usha",
      seller: SELLER,
      amountOre,
      t: t(locale),
      locale,
    })
  );
}

describe("beloppet på kvittot", () => {
  it("skrivs ut i kronor", () => {
    expect(render(20000)).toContain("200");
  });

  it("avrundar ören till hela kronor utan att tappa beloppet", () => {
    // 12 345 ören = 123,45 kr. Kvittot visar hela kronor, som Stripe-kvittot.
    expect(render(12345)).toContain("123");
  });

  it("säger uttryckligen Gratis vid noll — inte tom rad", () => {
    // "0 kr" och ingenting alls ser likadant ut för den som letar efter
    // summan. Ordet gör det entydigt att biljetten var gratis.
    const html = render(0);
    expect(html).toContain("Gratis");
  });

  it("utelämnar raden helt när beloppet är okänt", () => {
    // Hellre ingen rad än en påhittad nolla: en manuell bokning som inte vet
    // vad som betalats ska inte påstå att den var gratis.
    const html = render(undefined);
    expect(html).not.toContain("Betalat");
    expect(html).not.toContain("Gratis");
  });

  it("står kvar på engelska och spanska", () => {
    expect(render(20000, "en")).toContain("Paid");
    expect(render(20000, "es")).toContain("Pagado");
  });
});
