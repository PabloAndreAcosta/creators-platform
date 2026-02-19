import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sets the Gold-exclusive release date for a listing and notifies
 * Gold/Platinum members about early access. Typically called when
 * a new listing is created, with releaseDate = now + 48 hours.
 */
export async function releaseEventToGoldMembers(
  listingId: string,
  releaseDate: Date
): Promise<void> {
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from('listings')
    .update({ release_to_gold_at: releaseDate.toISOString() })
    .eq('id', listingId);

  if (updateError) {
    console.error('Failed to set Gold release date:', updateError);
    throw new Error('Kunde inte sätta Gold-exklusiv release');
  }

  // Get listing title for notification
  const { data: listing } = await supabase
    .from('listings')
    .select('title')
    .eq('id', listingId)
    .single();

  const title = listing?.title ?? 'Nytt event';

  // Get all Gold and Platinum members
  const { data: goldMembers, error: membersError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('tier', ['gold', 'platinum']);

  if (membersError) {
    console.error('Failed to fetch Gold members:', membersError);
    return;
  }

  console.log(
    `Early bird: "${title}" released to ${goldMembers?.length ?? 0} Gold/Platinum members, public at ${releaseDate.toISOString()}`
  );

  // TODO: Send email to each Gold/Platinum member
  // Subject: "Nytt event exklusivt för dig!"
  // Body: `${title} — tillgängligt för alla om 48 timmar.`
}

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
  if (userTier === 'gold' || userTier === 'platinum') {
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
