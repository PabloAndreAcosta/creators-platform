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

- Köpa biljett till en kväll, kurs eller workshop. Betalning med kort, Apple Pay eller Google Pay. Klarna från 1 000 kr.
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
- [Usha jämfört med Tickster och Billetto](${BAS}/jamfor): avgifter, betalsätt, incheckning, klippkort och BankID sida vid sida, med källor och datum. Säger också när Usha inte passar.
- [The Lab](${BAS}/series/the-lab-torsdag): Ushas egen practica i tarraxo och urban kizomba, varje torsdag 17–23 på Bacchi Syre, Järntorgsgatan 5 i Gamla stan, Stockholm. Teknikträning med instruktör på plats, socialdans tillåten, öppen nivå, ingen egen partner behövs. 130 kr för hela kvällen eller klippkort. Nästa kväll: ${BAS}/event/the-lab-torsdag.
- [Instruktörer](${BAS}/instruktorer): kreatörer som undervisar, coachar eller tränar andra, med pris och format.
- [Bli taxidansare](${BAS}/taxi): dansa som volontär på The Lab, med fri entré och matkupong. Kräver Mobilt BankID och 18 år.
- [Jobba med Usha](${BAS}/jobba): tre vägar in – volontär, instruktör som säljer privatlektioner på öppna kvällar, eller uppdrag.
- [Köpvillkor](${BAS}/terms) och [ångerrätt](${BAS}/refund-policy).
- [Säkerhet](${BAS}/sakerhet): hur vi skyddar konton och personuppgifter – BankID, data i EU (Supabase Frankfurt), Stripe för betalningar, daglig backup, automatisk säkerhetskontroll varje månad, underleverantörer med intyg. GDPR; inget SOC 2-intyg i dag.
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
