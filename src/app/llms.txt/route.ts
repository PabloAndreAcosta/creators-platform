import { fetchUpcomingListings } from "@/lib/calendar/visibility";
import { groupUpcoming } from "@/lib/calendar/upcoming";
import { stockholmDay } from "@/lib/tickets/event-day";
import { stockholmEventISO } from "@/lib/time";

/**
 * /llms.txt — vad Usha är, för språkmodeller som läser sajten.
 *
 * Konventionen (llmstxt.org) är en kort markdown-fil som beskriver sajten och
 * pekar ut de sidor som är värda att läsa. Vi gör den levande i stället för
 * statisk: en modell som får frågan "vad händer i Stockholm i helgen" ska se
 * vad som faktiskt står på programmet, inte bara hur sajten är uppbyggd.
 *
 * Bara publika, aktiva annonser med datum framåt — samma källa som /kalender,
 * så filen aldrig kan säga något annat än sidan.
 */
export const revalidate = 3600;

const BAS = "https://usha.se";

function rad(e: {
  title: string;
  href: string;
  date: string;
  time: string | null;
  location: string | null;
  price: number | null;
  occurrences: number;
}): string {
  const när = stockholmEventISO(e.date, e.time);
  const var_ = e.location ? `, ${e.location}` : "";
  const pris = e.price ? `, från ${e.price} kr` : "";
  const fler = e.occurrences > 1 ? ` (${e.occurrences} tillfällen)` : "";
  return `- [${e.title}](${BAS}${e.href}): ${när}${var_}${pris}${fler}`;
}

export async function GET() {
  let program = "";
  try {
    const entries = groupUpcoming(await fetchUpcomingListings(), stockholmDay(new Date()));
    if (entries.length) {
      program = `\n## På programmet\n\nKommande händelser, uppdaterade varje timme. Tider i svensk tidszon.\n\n${entries
        .slice(0, 40)
        .map(rad)
        .join("\n")}\n`;
    }
  } catch {
    // Går frågan fel ska filen ändå beskriva plattformen — ett tomt program är
    // bättre än en 500 som får crawlern att sluta komma tillbaka.
  }

  const text = `# Usha Platform

> Svensk plattform där kreatörer säljer biljetter till sina evenemang, kurser och tjänster, lokaler fyller sin kalender och publiken hittar vad som händer. Betalningar via Stripe, identitet via BankID.

Usha Platform drivs av Usha AB (org.nr 559401-8326), Stockholm. Innehållet är på svenska, engelska och spanska; svenska är original.

En kreatör är inte bara en dansare. Det är alla som har något att lära ut eller visa upp — dans, musik, träning, hantverk, föreläsningar. En lokal är en plats som vill ha ett levande program utan att själv boka in varje kväll.

## Vad man kan göra här

- Köpa biljett till en kväll, kurs eller workshop. Betalning med kort, Klarna, Apple Pay eller Google Pay.
- Köpa klippkort som gäller på en hel serie kvällar.
- Hitta kreatörer och lokaler per stad och kategori.
- Som kreatör: lägga upp evenemang, sälja biljetter, checka in gäster i dörren med QR och göra upp med lokalen automatiskt.

## Sidor värda att läsa

- [Kalender](${BAS}/kalender): allt som är på gång, grupperat per dag.
- [Upplevelser](${BAS}/upplevelser): evenemang per stad och kategori.
- [Marketplace](${BAS}/marketplace): tjänster, kurser och produkter från kreatörer.
- [Platser](${BAS}/platser): lokaler som har program hos oss.
- [För kreatörer](${BAS}/for-kreatorer): vad plattformen gör för den som håller i kvällen.
- [För platser](${BAS}/for-platser): för lokaler som vill ha ett program.
- [För publik](${BAS}/for-publik): för den som vill gå på saker.
- [Om Usha](${BAS}/om): bakgrund och vilka vi är.
- [Köpvillkor](${BAS}/terms) och [ångerrätt](${BAS}/refund-policy).
${program}
## Om datan på sidorna

Evenemangssidor bär strukturerad data enligt schema.org (Event eller DanceEvent) med starttid i svensk tidszon inklusive offset, plats med postadress och koordinater, samt ett Offer per biljettyp. Läs den hellre än att tolka texten.

Sidkarta: ${BAS}/sitemap.xml
`;

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
