/**
 * Delningslänk och delningstext för ett evenemang.
 *
 * En delning har ett jobb: att leda mottagaren till biljettköpet. Två saker
 * avgör om den gör det.
 *
 * Länken måste peka på evenemangssidan, inte på arrangörens profil. En profil
 * berättar vem jag är; den säljer ingen biljett till just den här kvällen.
 *
 * Texten måste vara kort. Instagram, Messenger och WhatsApp klistrar in text
 * och länk i samma bubbla, och Chrome på Android fogar ihop dem med ett
 * mellanslag. Skickar man hela eventbeskrivningen begravs länken i slutet av
 * en textvägg — den blir svår att se och opålitlig att trycka på.
 */

export interface ShareableEvent {
  id: string;
  slug?: string | null;
  title: string;
  event_date?: string | null;
  event_time?: string | null;
  event_location?: string | null;
  event_venue?: string | null;
  price?: number | null;
}

/** Publik sökväg till evenemangssidan. Slug när den finns, annars id. */
export function eventPath(listing: Pick<ShareableEvent, "id" | "slug">): string {
  const handle = listing.slug?.trim() || listing.id;
  return `/event/${handle}`;
}

/** Absolut delningslänk. `origin` saknas vid server-rendering — fall tillbaka på usha.se. */
export function eventShareUrl(
  listing: Pick<ShareableEvent, "id" | "slug">,
  origin?: string | null
): string {
  const base = (origin?.trim() || "https://usha.se").replace(/\/+$/, "");
  return `${base}${eventPath(listing)}`;
}

const DATE_LOCALES: Record<string, string> = { sv: "sv-SE", en: "en-GB", es: "es-ES" };

/** "mån 7 sep · 17:00" — kort nog att stå på en rad i en chattbubbla. */
export function formatShareWhen(
  date: string | null | undefined,
  time: string | null | undefined,
  locale = "sv"
): string | null {
  const parts: string[] = [];
  if (date) {
    const d = new Date(`${date}T00:00`);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        d.toLocaleDateString(DATE_LOCALES[locale] ?? "en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    }
  }
  if (time) parts.push(time.slice(0, 5));
  return parts.length ? parts.join(" · ") : null;
}

export interface ShareSummaryParts {
  title: string;
  /** Formaterad tid, t.ex. "mån 7 sep · 17:00". */
  when?: string | null;
  /** Lokal eller adress. */
  where?: string | null;
  /** Färdig prisrad, t.ex. "Från 50 kr". */
  price?: string | null;
}

/**
 * Tre rader, aldrig fler: vad, när/var, pris. Beskrivningen hör hemma på
 * evenemangssidan — det är dit länken går.
 */
export function buildShareSummary(parts: ShareSummaryParts): string {
  const meta = [parts.when, parts.where]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(" · ");

  const lines = [parts.title.trim()];
  if (meta) lines.push(meta);
  const price = parts.price?.trim();
  if (price) lines.push(price);
  return lines.join("\n");
}

/**
 * Hela meddelandet med länken sist, för de ytor där vi själva bygger blobben
 * (WhatsApp, kopiera). Länken står ensam på sin rad så att den blir tryckbar.
 */
export function buildShareMessage(parts: ShareSummaryParts, url: string): string {
  return `${buildShareSummary(parts)}\n\n${url}`;
}

/**
 * Radbrytningen på slutet är avsiktlig: Chrome på Android limmar ihop `text`
 * och `url` med ett mellanslag, och utan den hamnar länken mitt i sista
 * meningen i stället för på egen rad.
 */
export function withTrailingBreak(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

/** Texten som skickas till `navigator.share`. */
export function nativeShareText(parts: ShareSummaryParts): string {
  return withTrailingBreak(buildShareSummary(parts));
}
