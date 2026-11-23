-- Lock down promo_codes writes.
--
-- The "Creators can manage own promo codes" policy was FOR ALL USING
-- (auth.uid() = created_by). With no WITH CHECK, a regular user could INSERT a
-- promo_codes row with created_by = themselves straight from the browser client
-- — i.e. mint their own 100%-off code. No legitimate flow needs user-client
-- writes here: the admin promo dashboard and the referral welcome-promo both
-- write via the service-role client (which bypasses RLS). Drop the policy so all
-- writes are service-role only; reads still work via the separate
-- "Active promo codes are readable" (is_active = true) SELECT policy.

DROP POLICY IF EXISTS "Creators can manage own promo codes" ON public.promo_codes;
