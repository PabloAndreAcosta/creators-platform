-- Instruktörer utan bolag går med på öppna kvällar och får lön via Usha
-- (SAMekonomi) i stället för utbetalning till eget Stripe-konto.
--
-- Stripe-kontot krävs därför bara av den som har ett verifierat bolag (eller
-- är Ushas egen säljare): hen får pengarna direkt. Utan bolag säljer Usha
-- minuterna i eget namn och inget Connect-konto behövs.
--
-- Profilkontrollen flyttas till en SECURITY DEFINER-funktion: stripe_account_id
-- och bolagsfälten är kolumnlåsta för authenticated och ska inte behöva vara
-- läsbara för att policyn ska fungera. Samma regel som joinOpenEvent.

CREATE OR REPLACE FUNCTION public.instructor_profile_ready(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role IN ('creator', 'kreator')
      AND p.offers_coaching = true
      AND p.coaching_hourly_rate_sek IS NOT NULL
      AND p.coaching_hourly_rate_sek > 0
      AND (
        p.stripe_account_id IS NOT NULL
        OR NOT (
          COALESCE(p.is_usha_owned_seller, false)
          OR (COALESCE(p.is_company, false) AND p.company_verified_at IS NOT NULL)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.instructor_profile_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instructor_profile_ready(uuid) TO authenticated;

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
          OR (l.event_date - (EXTRACT(ISODOW FROM l.event_date)::int - 1))
             >= (now() AT TIME ZONE 'Europe/Stockholm')::date
        )
    )
  );
