/**
 * Kort sammanfattning överst på eventsidan.
 *
 * PROBLEMET: beskrivningarna är långa, och det ska de få vara — de bär tema,
 * ton och detaljer. Men den som står med telefonen i handen och undrar "när,
 * var, kostar det något" ska inte behöva läsa sex stycken för att få veta.
 * På The Labs sidor låg dessutom hela texten före biljetterna, så svaret på
 * frågan "vad kostar det" krävde en scroll genom allt annat.
 *
 * LÖSNINGEN: vi plockar ut det som redan ÄR en sammanfattning i texten —
 * punktlistan med passen — och visar den öppet. Resten fälls in. Ingenting
 * tas bort och ingenting skrivs om; arrangören behåller sin text precis som
 * den skrevs.
 *
 * Saknas punktlista tas första stycket i stället, kapat vid en meningsgräns.
 * Det är sämre än en punktlista men bättre än ingenting, och det kräver inte
 * att någon skriver om sina gamla beskrivningar.
 */

/**
 * En rad som arrangören själv skrivit som sammanfattning.
 * "TLDR: öppen träning, ingen ledd workshop, 50 kr hela kvällen."
 * Den vinner alltid över det vi kan gissa oss till ur brödtexten.
 */
const EGEN = /^\s*(?:tl;?dr|i korthet|kort(?:fattat)?|in short|en resumen)\s*[:–—-]\s*(.+)$/i;

/** Punkttecken vi känner igen i början av en rad. */
const PUNKT = /^\s*[•·▪‣*\-–—]\s+(.+)$/;

/** Rader som är rubriker snarare än innehåll: "THE LAB — ÖPPEN TRÄNING". */
function ärRubrik(rad: string): boolean {
  const t = rad.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  const bokstäver = t.replace(/[^\p{L}]/gu, "");
  if (bokstäver.length < 3) return false;
  return bokstäver === bokstäver.toUpperCase();
}

export type Tldr = {
  /** Raderna som visas öppet, i ordning. Tom lista = ingen sammanfattning. */
  punkter: string[];
  /** Texten som fälls in. Tom sträng = allt rymdes i sammanfattningen. */
  rest: string;
};

const MAX_PUNKTER = 6;
const MAX_TECKEN = 220;

export function buildTldr(primary: string | null | undefined): Tldr {
  const text = (primary ?? "").trim();
  if (!text) return { punkter: [], rest: "" };

  const rader = text.split("\n");

  // 1. Har arrangören skrivit en egen sammanfattning är det den som gäller.
  for (const rad of rader) {
    const egen = EGEN.exec(rad);
    if (!egen) continue;
    const rest = rader
      .filter((r) => !EGEN.test(r))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { punkter: [egen[1].trim()], rest };
  }

  // 2. Annars punktlistan, som oftast är kvällens upplägg.
  const punkter: string[] = [];
  for (const rad of rader) {
    const träff = PUNKT.exec(rad);
    if (träff) punkter.push(träff[1].trim());
    if (punkter.length >= MAX_PUNKTER) break;
  }

  if (punkter.length > 0) {
    // Resten är allt utom punkterna själva. Att visa dem två gånger — en gång
    // i sammanfattningen och en gång i den infällda texten — får sidan att se
    // ut som ett misstag.
    const kvar = rader
      .filter((rad) => !PUNKT.test(rad))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { punkter, rest: kvar };
  }

  // Ingen punktlista: ta första stycket som inte bara är en rubrik.
  const stycken = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const första = stycken.find((s) => !s.split("\n").every(ärRubrik));
  if (!första) return { punkter: [], rest: text };

  const sammanfattning = kapa(första, MAX_TECKEN);
  const index = stycken.indexOf(första);
  const rest = stycken.slice(index).join("\n\n").trim();
  return { punkter: [sammanfattning], rest };
}

/**
 * Kapar vid närmaste meningsslut före gränsen, annars vid ett ordslut.
 * Ett avhugget ord mitt i en sammanfattning ser ut som ett fel i koden.
 */
function kapa(text: string, max: number): string {
  const ren = text.replace(/\s+/g, " ").trim();
  if (ren.length <= max) return ren;

  const bit = ren.slice(0, max);
  const mening = Math.max(bit.lastIndexOf(". "), bit.lastIndexOf("! "), bit.lastIndexOf("? "));
  if (mening > max * 0.4) return bit.slice(0, mening + 1);

  const ord = bit.lastIndexOf(" ");
  return (ord > 0 ? bit.slice(0, ord) : bit).trimEnd() + "…";
}
