import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Checks whether a listing has reached its booking capacity.
 * Returns true if full, false if spots remain.
 */
export async function handleCapacityReached(
  listingId: string,
  capacity: number
): Promise<boolean> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .in('status', ['pending', 'confirmed']);

  if (error) {
    console.error('Failed to check capacity:', error);
    return false;
  }

  return (count ?? 0) >= capacity;
}

/**
 * Adds a user to the booking queue for a listing.
 * Gold and Platinum members are placed at position 1 (priority).
 * Regular users are placed at the back of the queue.
 */
export async function addToQueue(
  listingId: string,
  userId: string,
  userTier: string | null
): Promise<{ queuePosition: number; estimatedTime?: string }> {
  const supabase = createAdminClient();
  const isPriority = userTier === 'gold' || userTier === 'platinum';

  // Get current max position
  const { data: existing, error: fetchError } = await supabase
    .from('booking_queue')
    .select('id, position')
    .eq('listing_id', listingId)
    .order('position', { ascending: true });

  if (fetchError) {
    console.error('Failed to fetch queue:', fetchError);
    throw new Error('Kunde inte hämta kön');
  }

  let position: number;

  if (isPriority) {
    // Shift all existing positions down by 1
    for (const entry of existing ?? []) {
      await supabase
        .from('booking_queue')
        .update({ position: entry.position + 1 })
        .eq('id', entry.id);
    }
    position = 1;
  } else {
    const maxPosition = existing?.length
      ? Math.max(...existing.map((e) => e.position))
      : 0;
    position = maxPosition + 1;
  }

  const { error: insertError } = await supabase.from('booking_queue').insert({
    listing_id: listingId,
    user_id: userId,
    position,
  });

  if (insertError) {
    // Duplicate entry — user already in queue
    if (insertError.code === '23505') {
      const current = await getQueuePosition(listingId, userId);
      return { queuePosition: current ?? position };
    }
    console.error('Failed to add to queue:', insertError);
    throw new Error('Kunde inte gå med i kön');
  }

  // Rough estimate: ~2 hours per position
  const estimatedTime =
    position <= 3
      ? 'Inom kort'
      : `Uppskattad väntetid: ~${position * 2} timmar`;

  return { queuePosition: position, estimatedTime };
}

/**
 * Promotes the first person in the queue when a booking is cancelled.
 * Creates a new booking for them and marks the queue entry as auto-booked.
 */
export async function autoPromoteFromQueue(listingId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get the first person in the queue
  const { data: next, error: queueError } = await supabase
    .from('booking_queue')
    .select('id, user_id, listing_id')
    .eq('listing_id', listingId)
    .eq('auto_booked', false)
    .order('position', { ascending: true })
    .limit(1)
    .single();

  if (queueError || !next) {
    // No one in queue — nothing to do
    return;
  }

  // Get listing details for the booking
  const { data: listing } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', listingId)
    .single();

  if (!listing) {
    console.error('Listing not found for auto-promote:', listingId);
    return;
  }

  // Create booking for the promoted user
  const { error: bookingError } = await supabase.from('bookings').insert({
    listing_id: listingId,
    creator_id: listing.user_id,
    customer_id: next.user_id,
    status: 'confirmed',
    scheduled_at: new Date().toISOString(),
  });

  if (bookingError) {
    console.error('Failed to auto-book from queue:', bookingError);
    return;
  }

  // Mark queue entry as auto-booked
  const { error: updateError } = await supabase
    .from('booking_queue')
    .update({
      auto_booked: true,
      auto_booked_at: new Date().toISOString(),
    })
    .eq('id', next.id);

  if (updateError) {
    console.error('Failed to update queue entry:', updateError);
  }

  // Reorder remaining queue positions
  const { data: remaining } = await supabase
    .from('booking_queue')
    .select('id, position')
    .eq('listing_id', listingId)
    .eq('auto_booked', false)
    .order('position', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('booking_queue')
        .update({ position: i + 1 })
        .eq('id', remaining[i].id);
    }
  }

  console.log(`Auto-booked user ${next.user_id} for listing ${listingId}`);
}

/**
 * Returns the current queue position for a user on a listing.
 * Returns null if the user is not in the queue.
 */
export async function getQueuePosition(
  listingId: string,
  userId: string
): Promise<number | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('booking_queue')
    .select('position')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .eq('auto_booked', false)
    .single();

  if (error || !data) return null;
  return data.position;
}
