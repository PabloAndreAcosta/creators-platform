-- ============================================================
-- Experience-specific bookings: listing types, guest counts,
-- attendee details, and special requests
-- ============================================================

-- ── Listings: add listing_type and guest capacity ────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'service'
    CHECK (listing_type IN ('service', 'event', 'table_reservation', 'spa_treatment', 'group_activity')),
  ADD COLUMN IF NOT EXISTS min_guests INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_guests INT,
  ADD COLUMN IF NOT EXISTS experience_details JSONB DEFAULT '{}';

-- ── Bookings: add guest_count, special_requests, attendees ──
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_count INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS special_requests TEXT,
  ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]';

-- ── Backfill listing_type from category ─────────────────────
UPDATE public.listings SET listing_type = 'event'
  WHERE category IN ('restaurant', 'concert', 'nightclub', 'spa', 'retreat', 'venue')
    AND (listing_type IS NULL OR listing_type = 'service');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON public.listings (listing_type);
