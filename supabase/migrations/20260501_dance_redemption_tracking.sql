-- Per-dance redemption tracking for dance_package listings.
-- dance_count on listings: how many dances are bundled in the package.
-- bookings.dances_total: snapshotted at booking time from the listing.
-- bookings.dances_redeemed: incremented one-by-one by the taxi_dancer.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS dance_count INTEGER
    CHECK (dance_count IS NULL OR dance_count > 0);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS dances_total INTEGER,
  ADD COLUMN IF NOT EXISTS dances_redeemed INTEGER NOT NULL DEFAULT 0
    CHECK (dances_redeemed >= 0);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_dances_redeemed_within_total;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_dances_redeemed_within_total
    CHECK (dances_total IS NULL OR dances_redeemed <= dances_total);
