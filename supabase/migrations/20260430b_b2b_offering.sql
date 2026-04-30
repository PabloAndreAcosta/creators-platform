-- ============================================================
-- Add 'b2b_offering' as a listing_type for taxi_dancer creators
-- to publish event-bookable services. Arrangörer (experience role)
-- can request bookings against these listings with custom date,
-- time, venue, and event description supplied at booking time.
-- ============================================================

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_listing_type_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_listing_type_check
    CHECK (listing_type IN (
      'service',
      'event',
      'table_reservation',
      'spa_treatment',
      'group_activity',
      'dance_package',
      'coaching_session',
      'b2b_offering'
    ));
