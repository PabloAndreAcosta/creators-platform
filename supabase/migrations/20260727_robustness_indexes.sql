-- Robustness + performance indexes (from the fresh whole-app audit).

-- 1. Idempotency: Stripe delivers webhook events at-least-once. The booking-level
--    idempotency check doesn't cover the payments-row insert on the b2b_payment
--    and digital_product branches, so a retry could duplicate a payments row and
--    inflate the revenue ledger. A unique index makes the insert idempotent.
--    (Verified: 0 existing duplicate stripe_payment_id in payments.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_stripe_payment_id
  ON public.payments (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- 2. Hot foreign-key filters that currently sequential-scan growing tables.
--    Every creator dashboard / analytics / insights / reminder query filters
--    bookings by creator_id or customer_id; none was indexed.
CREATE INDEX IF NOT EXISTS idx_bookings_creator
  ON public.bookings (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_customer
  ON public.bookings (customer_id, scheduled_at);

-- 3. listings is hit by marketplace, creator pages, events, venues and feed,
--    filtered by user_id and by the (is_active, is_public) public predicate.
CREATE INDEX IF NOT EXISTS idx_listings_user
  ON public.listings (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_public
  ON public.listings (is_active, is_public)
  WHERE is_active AND is_public;
