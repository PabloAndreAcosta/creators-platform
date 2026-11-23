-- Instruktörer får anmäla sig till ett öppet evenemang till och med samma dag
-- (Stockholmstid). Ersätter måndagsgränsen från 20261030. Samma regel som
-- src/lib/coaching/join-deadline.ts. Övriga villkor oförändrade mot prod.
DROP POLICY IF EXISTS "Eligible instructor joins open event" ON public.event_instructors;
CREATE POLICY "Eligible instructor joins open event" ON public.event_instructors
  FOR INSERT WITH CHECK (
    instructor_id = (SELECT auth.uid())
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND public.is_approved_instructor((SELECT auth.uid()), listing_id)
    AND public.instructor_profile_ready((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.is_active = true
        AND l.open_to_instructors = true
        AND (
          l.event_date IS NULL
          OR l.event_date >= (now() AT TIME ZONE 'Europe/Stockholm')::date
        )
    )
  );
