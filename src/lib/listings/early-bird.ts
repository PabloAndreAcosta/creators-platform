/**
 * Rester av Guld-exklusiv early bird. Knappen, mejlet till Guld-medlemmar och
 * API-vägen togs bort 2026-11-13 (en nivå, ingen att ge förtur åt). Kolumnen
 * release_to_gold_at ligger kvar och de här hjälparna läser den, så att ett
 * enstaka gammalt värde inte kan dölja ett event för någon.
 */

/**
 * Checks whether a listing is still in its Gold-exclusive window.
 * Returns true if only Gold/Platinum members should see it.
 */
export function isGoldExclusive(
  releaseToGoldAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!releaseToGoldAt) return false;
  return releaseToGoldAt.getTime() > now.getTime();
}

/**
 * Filters a list of events based on Gold exclusivity.
 * Gold and Platinum users see all events.
 * Other users only see events that are past their exclusive window.
 */
export function filterByGoldExclusivity<
  T extends { release_to_gold_at: string | null },
>(events: T[], userTier: string | null): T[] {
  if (userTier === 'guld' || userTier === 'premium') {
    return events;
  }

  const now = new Date();
  return events.filter(
    (event) =>
      !isGoldExclusive(
        event.release_to_gold_at ? new Date(event.release_to_gold_at) : null,
        now
      )
  );
}

/**
 * Returns the number of hours remaining until a listing becomes public.
 * Returns 0 if already public or no release date is set.
 */
export function getHoursUntilPublic(
  releaseToGoldAt: Date | null
): number {
  if (!releaseToGoldAt) return 0;

  const now = new Date();
  const diff = releaseToGoldAt.getTime() - now.getTime();

  if (diff <= 0) return 0;
  return Math.ceil(diff / (60 * 60 * 1000));
}
