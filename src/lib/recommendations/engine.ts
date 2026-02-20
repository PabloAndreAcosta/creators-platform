import { createAdminClient } from '@/lib/supabase/admin';

interface RecommendedListing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  event_tier: string;
  created_at: string;
  creator: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    tier: string;
  };
  bookingCount: number;
}

/**
 * Returns personalized event recommendations for a user based on their
 * booking history. Uses rule-based matching on categories and popularity.
 *
 * Ranking:
 *   1. Booking count (popularity, highest first)
 *   2. Creation date (newest first)
 *
 * Falls back to most popular events if user has no booking history.
 * This is the rule-based engine — can be swapped for AI-based later.
 */
export async function getRecommendations(
  userId: string,
  limit: number = 5
): Promise<RecommendedListing[]> {
  const supabase = createAdminClient();

  // 1. Get user's booking history
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('listing_id, creator_id, listings(category)')
    .eq('customer_id', userId)
    .in('status', ['pending', 'confirmed', 'completed']);

  if (bookingsError) {
    console.error('Failed to fetch booking history:', bookingsError);
    return getPopularEvents(limit);
  }

  // No history — return popular events as fallback
  if (!bookings || bookings.length === 0) {
    console.log(`No booking history for user ${userId}, returning popular events`);
    return getPopularEvents(limit);
  }

  // 2. Extract user interests (categories) and already-booked data
  const categories = new Set<string>();
  const bookedCreatorIds = new Set<string>();
  const bookedListingIds = new Set<string>();

  for (const booking of bookings) {
    bookedCreatorIds.add(booking.creator_id);
    bookedListingIds.add(booking.listing_id);
    const category = (booking.listings as unknown as { category: string })?.category;
    if (category) categories.add(category);
  }

  console.log('Recommendation interests:', {
    userId,
    categories: Array.from(categories),
    bookedCreators: bookedCreatorIds.size,
    bookedListings: bookedListingIds.size,
  });

  // 3. Find matching active listings in the same categories, excluding already booked
  const { data: candidates, error: candidatesError } = await supabase
    .from('listings')
    .select(
      'id, title, description, category, price, duration_minutes, event_tier, created_at, user_id'
    )
    .eq('is_active', true)
    .in('category', Array.from(categories));

  if (candidatesError) {
    console.error('Failed to fetch candidates:', candidatesError);
    return getPopularEvents(limit);
  }

  // Filter out already-booked listings
  const filtered = (candidates ?? []).filter(
    (l) => !bookedListingIds.has(l.id)
  );

  if (filtered.length === 0) {
    console.log('No matching candidates, returning popular events');
    return getPopularEvents(limit);
  }

  // 4. Get booking counts for ranking
  const listingIds = filtered.map((l) => l.id);
  const { data: bookingCounts } = await supabase
    .from('bookings')
    .select('listing_id')
    .in('listing_id', listingIds)
    .in('status', ['pending', 'confirmed', 'completed']);

  const countMap = new Map<string, number>();
  for (const b of bookingCounts ?? []) {
    countMap.set(b.listing_id, (countMap.get(b.listing_id) ?? 0) + 1);
  }

  // Get creator profiles
  const creatorIds = Array.from(new Set(filtered.map((l) => l.user_id)));
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, tier')
    .in('id', creatorIds);

  const creatorMap = new Map(
    (creators ?? []).map((c) => [c.id, c])
  );

  // 5. Build results, rank, and return top N
  const results: RecommendedListing[] = filtered.map((l) => {
    const creator = creatorMap.get(l.user_id);
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      duration_minutes: l.duration_minutes,
      event_tier: l.event_tier,
      created_at: l.created_at,
      creator: {
        id: l.user_id,
        full_name: creator?.full_name ?? null,
        avatar_url: creator?.avatar_url ?? null,
        tier: creator?.tier ?? 'silver',
      },
      bookingCount: countMap.get(l.id) ?? 0,
    };
  });

  // Sort: popularity (desc), then newest first
  results.sort((a, b) => {
    if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return results.slice(0, limit);
}

/**
 * Fallback: returns the most popular active events by booking count.
 * Used when a user has no booking history.
 */
async function getPopularEvents(limit: number): Promise<RecommendedListing[]> {
  const supabase = createAdminClient();

  const { data: listings, error } = await supabase
    .from('listings')
    .select(
      'id, title, description, category, price, duration_minutes, event_tier, created_at, user_id'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !listings || listings.length === 0) {
    console.error('Failed to fetch popular events:', error);
    return [];
  }

  // Count bookings per listing
  const listingIds = listings.map((l) => l.id);
  const { data: bookingCounts } = await supabase
    .from('bookings')
    .select('listing_id')
    .in('listing_id', listingIds)
    .in('status', ['pending', 'confirmed', 'completed']);

  const countMap = new Map<string, number>();
  for (const b of bookingCounts ?? []) {
    countMap.set(b.listing_id, (countMap.get(b.listing_id) ?? 0) + 1);
  }

  // Get creator profiles
  const creatorIds = Array.from(new Set(listings.map((l) => l.user_id)));
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, tier')
    .in('id', creatorIds);

  const creatorMap = new Map(
    (creators ?? []).map((c) => [c.id, c])
  );

  const results: RecommendedListing[] = listings.map((l) => {
    const creator = creatorMap.get(l.user_id);
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      duration_minutes: l.duration_minutes,
      event_tier: l.event_tier,
      created_at: l.created_at,
      creator: {
        id: l.user_id,
        full_name: creator?.full_name ?? null,
        avatar_url: creator?.avatar_url ?? null,
        tier: creator?.tier ?? 'silver',
      },
      bookingCount: countMap.get(l.id) ?? 0,
    };
  });

  results.sort((a, b) => {
    if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return results.slice(0, limit);
}
