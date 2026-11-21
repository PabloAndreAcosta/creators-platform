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
