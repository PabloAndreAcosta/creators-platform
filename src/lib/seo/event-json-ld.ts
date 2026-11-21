/**
 * Byggstenar för Event-JSON-LD, gemensamma för eventsidan, kalendern och
 * seriesidan.
 *
 * Search Console klagade på att våra Event saknade image, description,
 * organizer och offers. Eventsidan hade dem redan — det var kalenderns
 * ItemList och seriesidans subEvent som bara bar namn, tid och plats. Samma
 * regel på tre ställen ska bo på ett (se project_geo_strukturerad_data: tre
 * sidor hade var sin variant av tidszonsregeln).
 *
 * Bara riktiga uppgifter: ett pris skrivs bara ut när vi vet det, och en
 * gratiskväll får pris 0, inte ett påhittat. Bilden faller tillbaka på
 * plattformens delningsbild eftersom ett evenemang utan egen bild ändå visas
 * med den när det delas.
 */
import { absoluteUrl } from "@/lib/seo/metadata";
import { stockholmEventISO } from "@/lib/time";
import type { SaleResult } from "@/lib/listings/sale-state";

/** Plattformens delningsbild (src/app/opengraph-image.tsx), 1200×630. */
export const DEFAULT_EVENT_IMAGE_PATH = "/opengraph-image";

export type EventAvailability =
  | "https://schema.org/InStock"
  | "https://schema.org/PreSale"
  | "https://schema.org/SoldOut";

/** Absolut bild-URL, eller plattformens delningsbild när evenemanget saknar egen. */
export function eventImage(url: string | null | undefined): string {
  const trimmed = url?.trim();
  return absoluteUrl(trimmed || DEFAULT_EVENT_IMAGE_PATH);
}

/**
 * Ren text för `description`: utan HTML-taggar, utan radbrytningar (de fyller
 * ingen funktion maskinläst och tar bort en hel klass av escapningsproblem)
 * och kapad på ordgräns. Tom text ger `undefined` så fältet utelämnas.
 */
export function plainDescription(text: string | null | undefined, max = 500): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Biljettläget i schema.org-termer. "Före" är förköp som inte öppnat än. */
export function availabilityFromSale(sale: Pick<SaleResult, "state" | "buyable">): EventAvailability {
  if (sale.buyable) return "https://schema.org/InStock";
  if (sale.state === "before") return "https://schema.org/PreSale";
  return "https://schema.org/SoldOut";
}

/**
 * När biljetterna började (eller börjar) säljas: förköpets start eller det
 * publika släppet om något av dem är satt, annars när evenemanget lades upp —
 * från då gick det att köpa. Ogiltiga datum hoppas över.
 */
export function saleValidFrom(listing: {
  early_bird_start?: string | null;
  public_sale_at?: string | null;
  created_at?: string | null;
}): string | undefined {
  const times = [listing.early_bird_start, listing.public_sale_at]
    .map((v) => (v ? new Date(v) : null))
    .filter((d): d is Date => !!d && !isNaN(d.getTime()));
  if (times.length) {
    return new Date(Math.min(...times.map((d) => d.getTime()))).toISOString();
  }
  if (listing.created_at) {
    const d = new Date(listing.created_at);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

export function eventOffer(input: {
  price: number;
  url: string;
  availability: EventAvailability;
  validFrom?: string;
  name?: string;
}) {
  return {
    "@type": "Offer",
    ...(input.name ? { name: input.name } : {}),
    price: Math.max(0, input.price),
    priceCurrency: "SEK",
    url: absoluteUrl(input.url),
    availability: input.availability,
    ...(input.validFrom ? { validFrom: input.validFrom } : {}),
  };
}

/**
 * Arrangören. `Organization` när evenemanget har ett eget arrangörsnamn
 * (en förening, en lokal), annars `Person` — kreatören som lagt upp det.
 */
export function eventOrganizer(input: {
  organizerName?: string | null;
  profile?: { id: string; full_name: string | null; slug: string | null } | null;
}) {
  const name = input.organizerName?.trim() || input.profile?.full_name?.trim();
  if (!name) return undefined;
  return {
    "@type": input.organizerName?.trim() ? "Organization" : "Person",
    name,
    ...(input.profile
      ? { url: absoluteUrl(`/creators/${input.profile.slug || input.profile.id}`) }
      : {}),
  };
}

type ProfileRef = { id: string; full_name: string | null; slug: string | null };

/**
 * Den som uppträder/leder. Search Console varnar för Event utan `performer`.
 * Ett eget arrangörsnamn ("Brazilian Zouk Stockholm", "The Lab") är gruppen
 * som håller i kvällen → `PerformingGroup`; annars kreatören som `Person`.
 * Inget namn alls → fältet utelämnas hellre än att hittas på.
 */
export function eventPerformer(input: { organizerName?: string | null; profile?: ProfileRef | null }) {
  const group = input.organizerName?.trim();
  if (group) return { "@type": "PerformingGroup", name: group };
  const name = input.profile?.full_name?.trim();
  if (!name || !input.profile) return undefined;
  return {
    "@type": "Person",
    name,
    url: absoluteUrl(`/creators/${input.profile.slug || input.profile.id}`),
  };
}

export type EventPlaceInput = {
  location?: string | null;
  venue?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const COUNTRY_SEGMENT = /^(sverige|sweden)$/i;
const POSTAL_SEGMENT = /^(\d{3}\s?\d{2})\s+(.+)$/;

/**
 * `Place` med `PostalAddress` ur det som faktiskt står i annonsen.
 *
 * event_location är fritext från Google Places eller handskriven, t.ex.
 * "Bacchi Syre, Järntorgsgatan 5, Gamla stan" eller "Järfälla Kampsport Klubb,
 * Fänriksvägen 1, 177 43 Järfälla, Sverige". Tidigare hamnade hela strängen i
 * streetAddress, med lokalens namn först. Nu: lokalens namn blir Place.name,
 * första delen med gatunummer blir streetAddress, "177 43 Järfälla" blir
 * postalCode + addressLocality, och event_city vinner som ort. Inget gissas —
 * saknas en del utelämnas den.
 */
export function eventPlace(input: EventPlaceInput) {
  const location = input.location?.trim() || "";
  const venue = input.venue?.trim() || "";
  const city = input.city?.trim() || "";
  if (!location && !venue && !city) return undefined;

  let segments = location
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  while (segments.length && COUNTRY_SEGMENT.test(segments[segments.length - 1])) segments.pop();

  let name = venue;
  if (segments.length) {
    const first = segments[0];
    if (venue && first.toLowerCase() === venue.toLowerCase()) {
      segments = segments.slice(1);
    } else if (!venue && segments.length > 1 && !/\d/.test(first)) {
      // "Järfälla Kampsport Klubb, Fänriksvägen 1, …" — första delen är namnet.
      name = first;
      segments = segments.slice(1);
    }
  }

  let postalCode: string | undefined;
  let postalLocality: string | undefined;
  segments = segments.filter((seg) => {
    const m = POSTAL_SEGMENT.exec(seg);
    if (m && !postalCode) {
      postalCode = m[1].replace(/\s/, " ");
      postalLocality = m[2].trim();
      return false;
    }
    return true;
  });

  const streetAddress = segments.find((seg) => /\d/.test(seg)) ?? (segments.length ? segments.join(", ") : undefined);
  const addressLocality = city || postalLocality;
  const address =
    streetAddress || addressLocality || postalCode
      ? {
          "@type": "PostalAddress",
          ...(streetAddress ? { streetAddress } : {}),
          ...(addressLocality ? { addressLocality } : {}),
          ...(postalCode ? { postalCode } : {}),
          addressCountry: "SE",
        }
      : undefined;

  return {
    "@type": "Place",
    name: name || streetAddress || location || city,
    ...(address ? { address } : {}),
    ...(typeof input.lat === "number" && typeof input.lng === "number"
      ? { geo: { "@type": "GeoCoordinates", latitude: input.lat, longitude: input.lng } }
      : {}),
  };
}

/** Dagen efter ett YYYY-MM-DD-datum, för kvällar som slutar efter midnatt. */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Sluttid som ISO med tidszon, eller `undefined` när den inte är känd.
 * En sluttid som ligger före (eller på) starttiden betyder att kvällen går
 * över midnatt — då är det nästa dag, annars blir endDate före startDate.
 */
export function eventEndISO(date: string, time?: string | null, endTime?: string | null): string | undefined {
  if (!endTime || !time) return undefined;
  const endDate = endTime.slice(0, 8) <= time.slice(0, 8) ? nextDay(date) : date;
  return stockholmEventISO(endDate, endTime);
}

export type EventStatus = "https://schema.org/EventScheduled" | "https://schema.org/EventCancelled";

/** Inaktiverad annons = inställd. Vi har ingen egen status för framflyttat. */
export function eventStatus(isActive?: boolean | null): EventStatus {
  return isActive === false ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled";
}

/** Är raden ett evenemang? Bara `event_date` avgör — listing_type går inte att lita på. */
export function isDatedEvent(listing: { event_date?: string | null }): listing is { event_date: string } {
  return typeof listing.event_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(listing.event_date);
}

export type EventJsonLdInput = {
  type?: "Event" | "DanceEvent";
  name: string;
  /** Sidans sökväg (/event/…) eller absolut URL. */
  path: string;
  event_date: string | null | undefined;
  event_time?: string | null;
  event_end_time?: string | null;
  is_active?: boolean | null;
  description?: string;
  imageUrl?: string | null;
  place: EventPlaceInput;
  organizerName?: string | null;
  profile?: ProfileRef | null;
  /** Används när varken arrangörsnamn eller profil finns. */
  fallbackOrganizer?: Record<string, unknown>;
  offers: { name?: string; price: number }[];
  availability: EventAvailability;
  validFrom?: string;
  superEventPath?: string;
};

/**
 * Hela Event-objektet (utan @context) för eventsidan, kalendern och seriesidan.
 *
 * Returnerar `null` för en rad utan event_date: en tjänst är inget Event, och
 * Google klassar ett Event utan startDate som kritiskt fel (det hände
 * /listing/foretagsevent och /listing/pt-small-group, som är listing_type
 * "event" utan datum). Anroparen visar då `serviceJsonLd` i stället.
 */
export function eventJsonLd(input: EventJsonLdInput): Record<string, unknown> | null {
  if (!isDatedEvent(input)) return null;
  const date = input.event_date as string;
  const url = absoluteUrl(input.path);
  const endDate = eventEndISO(date, input.event_time, input.event_end_time);
  const location = eventPlace(input.place);
  const organizer =
    eventOrganizer({ organizerName: input.organizerName, profile: input.profile ?? null }) ??
    input.fallbackOrganizer;
  const performer = eventPerformer({ organizerName: input.organizerName, profile: input.profile ?? null });
  const offers = input.offers.map((o) =>
    eventOffer({
      name: o.name,
      price: o.price,
      url,
      availability: input.availability,
      validFrom: input.validFrom,
    })
  );
  return {
    "@type": input.type ?? "Event",
    name: input.name,
    url,
    ...(input.description ? { description: input.description } : {}),
    image: [eventImage(input.imageUrl)],
    startDate: stockholmEventISO(date, input.event_time),
    ...(endDate ? { endDate } : {}),
    eventStatus: eventStatus(input.is_active),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(location ? { location } : {}),
    offers: offers.length === 1 ? offers[0] : offers,
    ...(organizer ? { organizer } : {}),
    ...(performer ? { performer } : {}),
    ...(input.superEventPath
      ? { superEvent: { "@type": "EventSeries", url: absoluteUrl(input.superEventPath) } }
      : {}),
  };
}

/**
 * En tjänst (listing utan event_date): `Service` med leverantör, plats och
 * pris. Inga datumfält — det finns inget datum att ange.
 */
export function serviceJsonLd(input: {
  name: string;
  path: string;
  description?: string;
  imageUrl?: string | null;
  serviceType?: string | null;
  price?: number | null;
  place: EventPlaceInput;
  profile?: ProfileRef | null;
}): Record<string, unknown> {
  const url = absoluteUrl(input.path);
  const provider = eventPerformer({ profile: input.profile ?? null });
  const place = eventPlace(input.place);
  const areaServed = input.place.city?.trim()
    ? { "@type": "City", name: input.place.city.trim() }
    : undefined;
  return {
    "@type": "Service",
    name: input.name,
    url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.imageUrl?.trim() ? { image: absoluteUrl(input.imageUrl.trim()) } : {}),
    ...(input.serviceType ? { serviceType: input.serviceType } : {}),
    ...(provider ? { provider } : {}),
    ...(areaServed ? { areaServed } : {}),
    ...(place ? { availableChannel: { "@type": "ServiceChannel", serviceLocation: place } } : {}),
    ...(typeof input.price === "number" && input.price >= 0
      ? {
          offers: {
            "@type": "Offer",
            price: input.price,
            priceCurrency: "SEK",
            url,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}
