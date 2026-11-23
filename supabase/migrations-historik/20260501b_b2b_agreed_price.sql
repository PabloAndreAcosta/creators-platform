-- Negotiated B2B price: arrangör proposes a price in the request,
-- taxi_dancer accepts/declines as part of confirming. Used by
-- /api/stripe/booking-pay to charge the agreed amount instead of
-- listing.price for b2b_offering bookings.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agreed_price INTEGER
    CHECK (agreed_price IS NULL OR agreed_price >= 0);
