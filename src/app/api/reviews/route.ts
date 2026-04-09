import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyNewReview } from '@/lib/notifications/create';
import { awardPoints } from '@/lib/points/award';
import { POINT_VALUES } from '@/lib/points/constants';

// GET — fetch reviews for a creator
export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creatorId');
  if (!creatorId) {
    return NextResponse.json({ error: 'creatorId krävs' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch all ratings to compute correct average across all reviews
  const [{ data: reviews }, { data: allRatings }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id, listing_id, profiles!reviews_reviewer_id_fkey(full_name, avatar_url), listings(title)')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('reviews')
      .select('rating')
      .eq('creator_id', creatorId),
  ]);

  const ratings = (allRatings ?? []).map(r => r.rating);
  const average = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  return NextResponse.json({
    reviews: reviews ?? [],
    average,
    count: ratings.length,
  });
}

// POST — submit a review
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bookingId, rating, comment } = await req.json();

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Ogiltigt betyg (1-5) eller saknar bookingId' }, { status: 400 });
  }

  // Verify this is a completed booking belonging to the user
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, creator_id, listing_id, customer_id, status')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  }

  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Du kan bara recensera dina egna bokningar' }, { status: 403 });
  }

  if (booking.status !== 'completed') {
    return NextResponse.json({ error: 'Kan bara recensera slutförda bokningar' }, { status: 400 });
  }

  // Check if already reviewed
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Du har redan recenserat denna bokning' }, { status: 409 });
  }

  const { error } = await supabase.from('reviews').insert({
    booking_id: bookingId,
    reviewer_id: user.id,
    creator_id: booking.creator_id,
    listing_id: booking.listing_id,
    rating: Math.round(rating),
    comment: comment?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: 'Kunde inte spara recension' }, { status: 500 });
  }

  // In-app notification for the creator (non-blocking)
  const { data: reviewer } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  notifyNewReview(
    booking.creator_id,
    reviewer?.full_name || 'En användare',
    Math.round(rating)
  ).catch(err => console.error('Review notification failed:', err));

  // Award points (non-blocking)
  awardPoints({
    userId: user.id,
    action: 'review_written',
    points: POINT_VALUES.review_written,
    sourceId: bookingId,
    sourceType: 'review',
  }).catch(() => {});

  awardPoints({
    userId: booking.creator_id,
    action: 'review_received',
    points: POINT_VALUES.review_received,
    sourceId: bookingId,
    sourceType: 'review',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
