import { describe, it, expect } from "vitest";
import {
  eventEndISO,
  eventJsonLd,
  eventPerformer,
  eventPlace,
  eventStatus,
  serviceJsonLd,
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

  // Riktiga rader ur produktionen (SELECT 2026-11-21), bara de fält byggaren läser.
  const OSVALDO = { id: "1ff9ff46-4d82-46a2-b2a0-25fe3d373d78", full_name: "Osvaldo Palma Parola ", slug: "osvaldopalma" };
  const PABLO = { id: "15d852ed-1f33-446f-9bcb-821c2444c84f", full_name: "Pablo Acosta", slug: "pabloacosta" };
  const JARFALLA = {
    location: "Järfälla Kampsport Klubb, Fänriksvägen 1, 177 43 Järfälla, Sverige",
    venue: null,
    city: "Järfälla",
    lat: 59.4183106,
    lng: 17.8674799,
  };
  const BACCHI = {
    location: "Bacchi Syre, Järntorgsgatan 5, Gamla stan",
    venue: "Bacchi Syre",
    city: "Stockholm",
    lat: 59.3223822,
    lng: 18.0731005,
  };

  describe("tjänster (listing utan event_date)", () => {
    // /listing/foretagsevent och /listing/pt-small-group: listing_type "event"
    // men inget datum → Search Console: "Fältet startDate saknas".
    const foretagsevent = {
      name: "FÖRETAGSEVENT",
      path: "/listing/foretagsevent",
      event_date: null,
      event_time: null,
      event_end_time: null,
      place: JARFALLA,
      profile: OSVALDO,
      offers: [{ price: 5499 }],
      availability: "https://schema.org/InStock" as const,
    };

    it("ger inget Event utan datum", () => {
      expect(eventJsonLd(foretagsevent)).toBeNull();
      expect(eventJsonLd({ ...foretagsevent, path: "/listing/pt-small-group", event_date: "" })).toBeNull();
    });

    it("blir Service med leverantör, plats och pris — utan datumfält", () => {
      const ld = serviceJsonLd({
        name: "PT SMALL GROUP",
        path: "/listing/pt-small-group",
        description: "PT SMALL GROUP – THAIBOXNING FÖR 4 PERSONER",
        imageUrl: "https://hiurrvorwqfihtdfhbhv.supabase.co/storage/v1/object/public/listing-images/x.jpg",
        serviceType: "Fitness",
        price: 1800,
        place: JARFALLA,
        profile: OSVALDO,
      });
      expect(ld["@type"]).toBe("Service");
      expect(ld).not.toHaveProperty("startDate");
      expect(ld.provider).toEqual({
        "@type": "Person",
        name: "Osvaldo Palma Parola",
        url: "https://usha.se/creators/osvaldopalma",
      });
      expect(ld.areaServed).toEqual({ "@type": "City", name: "Järfälla" });
      expect(ld.offers).toMatchObject({ price: 1800, priceCurrency: "SEK", url: "https://usha.se/listing/pt-small-group" });
      expect(JSON.stringify(ld)).not.toMatch(/Event/);
    });
  });

  describe("adress ur annonsens fält", () => {
    it("Bacchi Syre: lokalens namn ur event_venue, gata och ort separat", () => {
      expect(eventPlace(BACCHI)).toEqual({
        "@type": "Place",
        name: "Bacchi Syre",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Järntorgsgatan 5",
          addressLocality: "Stockholm",
          addressCountry: "SE",
        },
        geo: { "@type": "GeoCoordinates", latitude: 59.3223822, longitude: 18.0731005 },
      });
    });

    it("Google Places-format: namn, gata, postnummer och land", () => {
      expect(eventPlace(JARFALLA)).toMatchObject({
        name: "Järfälla Kampsport Klubb",
        address: {
          streetAddress: "Fänriksvägen 1",
          postalCode: "177 43",
          addressLocality: "Järfälla",
          addressCountry: "SE",
        },
      });
    });

    it("hittar inte på något som saknas", () => {
      expect(eventPlace({ location: null, venue: null, city: null })).toBeUndefined();
      const bara = eventPlace({ location: "Kulturhuset", venue: null, city: null });
      expect(bara).toEqual({ "@type": "Place", name: "Kulturhuset", address: { "@type": "PostalAddress", streetAddress: "Kulturhuset", addressCountry: "SE" } });
    });
  });

  it("sluttid: utelämnas när den saknas, nästa dag när kvällen går över midnatt", () => {
    expect(eventEndISO("2026-11-26", "17:00:00", "23:00:00")).toBe("2026-11-26T23:00:00+01:00");
    expect(eventEndISO("2026-11-28", "21:00:00", "02:00:00")).toBe("2026-11-29T02:00:00+01:00");
    expect(eventEndISO("2026-11-26", "17:00:00", null)).toBeUndefined();
    expect(eventEndISO("2026-11-26", null, "23:00:00")).toBeUndefined();
  });

  it("status: inaktiverad = inställd", () => {
    expect(eventStatus(true)).toBe("https://schema.org/EventScheduled");
    expect(eventStatus(undefined)).toBe("https://schema.org/EventScheduled");
    expect(eventStatus(false)).toBe("https://schema.org/EventCancelled");
  });

  it("performer: arrangörsnamnet som grupp, annars kreatören", () => {
    expect(eventPerformer({ organizerName: "The Lab", profile: PABLO })).toEqual({ "@type": "PerformingGroup", name: "The Lab" });
    expect(eventPerformer({ organizerName: null, profile: PABLO })).toEqual({
      "@type": "Person",
      name: "Pablo Acosta",
      url: "https://usha.se/creators/pabloacosta",
    });
    expect(eventPerformer({ organizerName: " ", profile: null })).toBeUndefined();
  });

  it("The Lab 2026-11-26 (riktig rad): alla fält Search Console varnade för", () => {
    const ld = eventJsonLd({
      type: "DanceEvent",
      name: "The Lab Torsdag – Practica (Kizomba, Semba, Tarraxo & Urban Kizomba)",
      path: "/event/the-lab-torsdag-tarraxo-urban-kizomba-2026-11-26",
      event_date: "2026-11-26",
      event_time: "17:00:00",
      event_end_time: "23:00:00",
      is_active: true,
      description: "THE LAB — PRACTICA",
      imageUrl: "https://hiurrvorwqfihtdfhbhv.supabase.co/storage/v1/object/public/event-images/the-lab/thelab-bacchi-a-1788760535522.jpg",
      place: BACCHI,
      organizerName: "The Lab",
      profile: PABLO,
      offers: [{ price: 130 }],
      availability: "https://schema.org/InStock",
      validFrom: "2026-11-10T09:13:32.962Z",
      superEventPath: "/series/the-lab-torsdag",
    })!;
    expect(ld["@type"]).toBe("DanceEvent");
    expect(ld.startDate).toBe("2026-11-26T17:00:00+01:00");
    expect(ld.endDate).toBe("2026-11-26T23:00:00+01:00");
    expect(ld.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(ld.performer).toEqual({ "@type": "PerformingGroup", name: "The Lab" });
    expect(ld.organizer).toMatchObject({ "@type": "Organization", name: "The Lab" });
    expect(ld.location).toMatchObject({ address: { streetAddress: "Järntorgsgatan 5", addressLocality: "Stockholm" } });
    expect(ld.offers).toEqual({
      "@type": "Offer",
      price: 130,
      priceCurrency: "SEK",
      url: "https://usha.se/event/the-lab-torsdag-tarraxo-urban-kizomba-2026-11-26",
      availability: "https://schema.org/InStock",
      validFrom: "2026-11-10T09:13:32.962Z",
    });
    expect(ld.superEvent).toEqual({ "@type": "EventSeries", url: "https://usha.se/series/the-lab-torsdag" });
  });

  it("flera biljettyper ger en Offer var, alla med url och validFrom", () => {
    const ld = eventJsonLd({
      name: "Brazilian Zouk Tisdag – Practica, Workshop & Social",
      path: "/event/brazilian-zouk-tisdag-2026-12-01",
      event_date: "2026-12-01",
      event_time: "17:00:00",
      event_end_time: "22:00:00",
      place: BACCHI,
      organizerName: "Brazilian Zouk Stockholm",
      profile: PABLO,
      offers: [{ name: "Practica", price: 50 }, { name: "Allt", price: 120 }],
      availability: "https://schema.org/InStock",
      validFrom: "2026-11-16T11:16:44.303Z",
    })!;
    const offers = ld.offers as Record<string, unknown>[];
    expect(offers).toHaveLength(2);
    for (const o of offers) {
      expect(o.url).toBe("https://usha.se/event/brazilian-zouk-tisdag-2026-12-01");
      expect(o.validFrom).toBe("2026-11-16T11:16:44.303Z");
    }
  });
});
