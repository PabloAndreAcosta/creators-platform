/**
 * Vilka som ska få veta att ett nytt evenemang lagts upp.
 *
 * Tidigare var svaret enkelt: arrangörens följare. När ett evenemang kan kopplas
 * till en lokal blir det två grupper, och då uppstår tre fällor som alla ger
 * dålig e-post. Den här funktionen finns för att fånga dem på ett ställe, med
 * test, i stället för att gömma dem i en loop i ett cronjobb.
 */

export interface AudienceInput {
  /** Följare till arrangören. */
  creatorFollowers: readonly string[];
  /** Följare till lokalen. Tom om evenemanget saknar bekräftad lokal. */
  venueFollowers?: readonly string[];
  /** Arrangörens profil-id. */
  creatorId: string;
  /** Lokalens profil-id, om evenemanget har en bekräftad lokal. */
  venueId?: string | null;
}

/**
 * Returnerar mottagarna, en gång var.
 *
 * Tre regler, alla inlärda av hur det annars blir:
 *
 * 1. DUBBLETTER. Den som följer både dansaren och lokalen är precis den mest
 *    engagerade personen i registret — och skulle få två identiska mejl om
 *    samma kväll. Det är det snabbaste sättet att lära någon att ignorera oss.
 *
 * 2. ARRANGÖREN SJÄLV. Att mejla någon om att den lagt upp sitt eget evenemang
 *    får systemet att verka trasigt.
 *
 * 3. LOKALEN SJÄLV. Lokalen har redan bekräftat kopplingen manuellt. Den vet.
 */
export function buildNotifyAudience(input: AudienceInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const skip = new Set<string>([input.creatorId]);
  if (input.venueId) skip.add(input.venueId);

  for (const id of [...input.creatorFollowers, ...(input.venueFollowers ?? [])]) {
    if (!id || skip.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}
