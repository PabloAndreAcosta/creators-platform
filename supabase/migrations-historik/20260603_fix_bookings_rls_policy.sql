-- SECURITY FIX: remove the over-broad bookings policy introduced in
-- 20260408_guest_checkout.sql.
--
-- That migration created:
--   CREATE POLICY "Service role can manage all bookings" ON public.bookings
--     FOR ALL USING (true) WITH CHECK (true);
-- Despite the name it had NO `TO service_role` clause, so it applied to every
-- role (incl. anon + authenticated). Because the anon key ships to the browser,
-- that would have let anyone read/write/delete EVERY booking (guest PII, payment
-- and check-in state).
--
-- Production was already corrected manually (live `bookings` has only the
-- creator/customer-scoped policies), so on the live DB this DROP is a no-op.
-- This migration exists so the repo matches prod and a fresh environment never
-- reintroduces the hole. Server-side writes use the service-role key, which
-- bypasses RLS, so no permissive policy is needed for guest checkout.

DROP POLICY IF EXISTS "Service role can manage all bookings" ON public.bookings;

-- Optional explicit service-role policy (also a no-op for the service-role key,
-- which bypasses RLS — kept only for clarity if RLS-scoped tooling is added).
DROP POLICY IF EXISTS "Service role manages bookings" ON public.bookings;
CREATE POLICY "Service role manages bookings" ON public.bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
