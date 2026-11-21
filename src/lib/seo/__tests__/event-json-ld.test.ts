import { describe, it, expect } from "vitest";
import {
  availabilityFromSale,
  eventImage,
  eventOffer,
  eventOrganizer,
  plainDescription,
  saleValidFrom,
} from "../event-json-ld";

describe("event-json-ld", () => {
  it("ger absolut bild, och delningsbilden när evenemanget saknar egen", () => {
    expect(eventImage("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(eventImage("/bilder/a.jpg")).toBe("https://usha.se/bilder/a.jpg");
    expect(eventImage(null)).toBe("https://usha.se/opengraph-image");
    expect(eventImage("  ")).toBe("https://usha.se/opengraph-image");
  });

  it("gör beskrivningen till ren text och kapar på ordgräns", () => {
    expect(plainDescription("Salsa <b>ikväll</b>\n\nmed  DJ")).toBe("Salsa ikväll med DJ");
    expect(plainDescription("   ")).toBeUndefined();
    expect(plainDescription(null)).toBeUndefined();
    const lång = "ord ".repeat(200);
    const kapad = plainDescription(lång, 50)!;
    expect(kapad.length).toBeLessThanOrEqual(50);
    expect(kapad.endsWith("…")).toBe(true);
    expect(kapad).not.toMatch(/\s…$/);
  });

  it("översätter biljettläget", () => {
    expect(availabilityFromSale({ state: "on_sale", buyable: true })).toBe("https://schema.org/InStock");
    expect(availabilityFromSale({ state: "early_bird", buyable: true })).toBe("https://schema.org/InStock");
    expect(availabilityFromSale({ state: "before", buyable: false })).toBe("https://schema.org/PreSale");
    expect(availabilityFromSale({ state: "sold_out", buyable: false })).toBe("https://schema.org/SoldOut");
  });

  it("tar tidigaste försäljningsstart, annars när evenemanget lades upp", () => {
    expect(
      saleValidFrom({
        early_bird_start: "2026-11-10T08:00:00Z",
        public_sale_at: "2026-11-01T08:00:00Z",
        created_at: "2026-10-01T08:00:00Z",
      })
    ).toBe("2026-11-01T08:00:00.000Z");
    expect(saleValidFrom({ created_at: "2026-10-01T08:00:00Z" })).toBe("2026-10-01T08:00:00.000Z");
    expect(saleValidFrom({ early_bird_start: "inte ett datum" })).toBeUndefined();
    expect(saleValidFrom({})).toBeUndefined();
  });

  it("bygger ett Offer i SEK med absolut URL, och 0 för gratis", () => {
    expect(
      eventOffer({ price: 0, url: "/event/x", availability: "https://schema.org/InStock", validFrom: "2026-10-01T08:00:00.000Z" })
    ).toEqual({
      "@type": "Offer",
      price: 0,
      priceCurrency: "SEK",
      url: "https://usha.se/event/x",
      availability: "https://schema.org/InStock",
      validFrom: "2026-10-01T08:00:00.000Z",
    });
    expect(eventOffer({ price: 120, url: "/event/x", availability: "https://schema.org/SoldOut", name: "Practica" })).toMatchObject({
      name: "Practica",
      price: 120,
    });
    expect(eventOffer({ price: 120, url: "/event/x", availability: "https://schema.org/SoldOut" })).not.toHaveProperty("validFrom");
  });

  it("arrangör: eget namn blir Organization, annars kreatören som Person", () => {
    const profile = { id: "p1", full_name: "Ana", slug: "ana" };
    expect(eventOrganizer({ organizerName: "Salsaföreningen", profile })).toEqual({
      "@type": "Organization",
      name: "Salsaföreningen",
      url: "https://usha.se/creators/ana",
    });
    expect(eventOrganizer({ organizerName: null, profile })).toEqual({
      "@type": "Person",
      name: "Ana",
      url: "https://usha.se/creators/ana",
    });
    expect(eventOrganizer({ profile: { id: "p2", full_name: "Bo", slug: null } })?.url).toBe("https://usha.se/creators/p2");
    expect(eventOrganizer({ organizerName: "", profile: null })).toBeUndefined();
  });
});
