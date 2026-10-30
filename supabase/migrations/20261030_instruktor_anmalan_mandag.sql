-- Instruktörer anmäler sig till ett öppet evenemang senast måndag samma vecka
-- (Stockholmstid). Samma regel som src/lib/coaching/join-deadline.ts; den
-- ligger här också så att ett direktanrop mot PostgREST inte kringgår den.
DROP POLICY IF EXISTS "Eligible instructor joins open event" ON public.event_instructors;
CREATE POLICY "Eligible instructor joins open event" ON public.event_instructors
  FOR INSERT WITH CHECK (
    instructor_id = (SELECT auth.uid())
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('creator', 'kreator')
        AND p.offers_coaching = true
        AND p.coaching_hourly_rate_sek IS NOT NULL
        AND p.coaching_hourly_rate_sek > 0
        AND p.stripe_account_id IS NOT NULL
        AND p.tier IN ('guld', 'premium')
    )
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.is_active = true
        AND l.open_to_instructors = true
        AND (
          l.event_date IS NULL
          OR (l.event_date - (EXTRACT(ISODOW FROM l.event_date)::int - 1))
             >= (now() AT TIME ZONE 'Europe/Stockholm')::date
        )
    )
  );
