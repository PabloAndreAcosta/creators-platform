/**
 * Veckokontroll: letar efter det som glidit isär utan att någon märkt det.
 *
 * Bakgrunden är konkret. Sju Facebook-kvällar ärvde premiärens biljettlänk, så
 * sex av dem sålde biljetter till fel datum — i tre dygn, tills någon råkade
 * titta. Ett omslagsbyte sparades utan att ta. En avräkning räknades på fel
 * status och gav 120 kr i stället för 1080. Inget av det syntes någonstans; det
 * upptäcktes för att en människa kände igen att en siffra såg fel ut.
 *
 * Det här jobbet är motsatsen till ett larm man väntar på. Det letar efter fel
 * ingen bett det leta efter, och hör av sig bara när det hittar något.
 *
 * REGELN OM TYSTNAD: ett mejl som går varje vecka oavsett läge slutar läsas.
 * Storage-backupen låg nere i trettio dagar just därför. Hittar kontrollen
 * ingenting skickas ingenting.
 */

export type Allvar = "blockerar" | "bör_rättas";

export interface Avvikelse {
  allvar: Allvar;
  regel: string;
  kvall: string;
  detalj: string;
}

export interface KvallInput {
  id: string;
  slug: string | null;
  title: string;
  eventDate: string | null;
  isActive: boolean;
  price: number | null;
  facebookEventId: string | null;
  ticketTypeCount: number;
  /** Har kvällen en intäktsdelning med en lokal? (modell A) */
  harIntaktsdelning: boolean;
  /** Är säljaren någon annan än Usha? Då tas provision. (modell B) */
  saljsAvTredjepart: boolean;
}

/**
 * Datumet som står i slugen, om det finns ett.
 *
 * Slugen är inte dekoration: den är adressen köparen får, och den är det enda
 * som skiljer en kväll i en serie från nästa. Står fel datum där pekar
 * biljettlänken på fel kväll — exakt felet som drabbade Facebook-serien.
 */
export function datumIslug(slug: string | null): string | null {
  const m = (slug ?? "").match(/(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

/**
 * Granska en kväll. Returnerar noll eller flera avvikelser.
 *
 * `horisontDagar` styr hur långt fram vi bryr oss om att en kväll inte delats:
 * en kväll i november behöver inget Facebook-inlägg i september.
 */
export function granskaKvall(k: KvallInput, idag: string, horisontDagar: number): Avvikelse[] {
  const ut: Avvikelse[] = [];
  if (!k.isActive) return ut;
  if (!k.eventDate || k.eventDate < idag) return ut;

  const namn = `${k.title} ${k.eventDate}`;

  // 1. Slugens datum mot kvällens. Det här är felet som sålde biljetter till
  //    fel kväll, och det enda av dem som går att upptäcka i våra egna data.
  const slugDatum = datumIslug(k.slug);
  if (slugDatum && slugDatum !== k.eventDate) {
    ut.push({
      allvar: "blockerar",
      regel: "slug-datum",
      kvall: namn,
      detalj: `adressen slutar på ${slugDatum} men kvällen är ${k.eventDate}`,
    });
  }

  // 2. Går kvällen att köpa biljett till? Ett pris på noll utan biljettyper är
  //    inte en gratis kväll, det är en kväll som ingen kan boka.
  if (k.ticketTypeCount === 0 && (k.price ?? 0) <= 0) {
    ut.push({
      allvar: "blockerar",
      regel: "ingen-biljett",
      kvall: namn,
      detalj: "varken pris eller biljettyper — kvällen går inte att köpa",
    });
  }

  // 3. Båda modellerna på samma kväll. Se docs/lokalmodeller.md.
  //
  //    En kväll kör antingen intäktsdelning med lokalen ELLER provision från
  //    kreatören. Gäller båda får lokalen sin andel av kvällen samtidigt som
  //    kreatören får provision avdragen — någon blir betald två gånger eller
  //    ingen gång, och det upptäcks först när pengarna redan gått.
  if (k.harIntaktsdelning && k.saljsAvTredjepart) {
    ut.push({
      allvar: "blockerar",
      regel: "blandade-modeller",
      kvall: namn,
      detalj: "både intäktsdelning med lokal och provision från kreatör",
    });
  }

  // 4. Odelad kväll inom horisonten. Inte ett fel i sig, men det är så en
  //    kväll blir osåld: den finns, den är publik, och ingen vet om den.
  if (!k.facebookEventId && inomDagar(idag, k.eventDate, horisontDagar)) {
    ut.push({
      allvar: "bör_rättas",
      regel: "odelad",
      kvall: namn,
      detalj: "inget Facebook-inlägg",
    });
  }

  return ut;
}

/** Ligger `datum` inom `dagar` från `idag`? Båda som YYYY-MM-DD. */
export function inomDagar(idag: string, datum: string, dagar: number): boolean {
  const d = (Date.parse(datum) - Date.parse(idag)) / 86400000;
  return d >= 0 && d <= dagar;
}

/**
 * Gästköp som nu skulle kunna knytas till ett konto.
 *
 * Adoptionen sker vid inloggning, men den som köpte som gäst och aldrig loggar
 * in igen blir aldrig adopterad. Den här raden visar hur många som ligger kvar
 * — inte som ett fel att rätta automatiskt, utan som ett mått på hur stor den
 * osynliga halvan av publiken är.
 */
export function sammanfattaGaster(antal: number): Avvikelse | null {
  if (antal === 0) return null;
  return {
    allvar: "bör_rättas",
    regel: "gästköp-utan-konto",
    kvall: "—",
    detalj: `${antal} gästköp har en mejladress som matchar ett konto men saknar ägare`,
  };
}

/** Sorterar blockerande först; inom samma allvar efter regel och kväll. */
export function sortera(a: readonly Avvikelse[]): Avvikelse[] {
  const rang = (x: Avvikelse) => (x.allvar === "blockerar" ? 0 : 1);
  return [...a].sort(
    (x, y) => rang(x) - rang(y) || x.regel.localeCompare(y.regel, "sv") || x.kvall.localeCompare(y.kvall, "sv")
  );
}
