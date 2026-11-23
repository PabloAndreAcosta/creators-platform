-- Instruktörer på öppna kvällar ansöker och arrangören godkänner.
--
-- Tidigare kunde vilken Guld/Premium-instruktör som helst gå med på en öppen
-- kväll utan att arrangören sa ja. Nu gäller samma ansökan som för
-- volontärrollerna: en rad i volunteer_approvals med role = 'instructor' i
-- kvällens avgränsning (serien, annars arrangören). Godkänd = får gå med och
-- sälja minuter, även med gratiskonto (provisionen följer nivån som förut).
--
-- volunteer_approvals är stängd för authenticated, så kontrollen ligger i en
-- SECURITY DEFINER-funktion som bara svarar ja/nej. Samma regel finns i
-- joinOpenEvent (src/app/app/events/actions.ts) och i
-- src/lib/coaching/instructor-approval.ts.

CREATE OR REPLACE FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listings l
    JOIN public.volunteer_approvals a
      ON a.scope_key = CASE WHEN l.series_id IS NOT NULL
                            THEN 'series:' || l.series_id::text
                            ELSE 'host:' || l.user_id::text END
    WHERE l.id = p_listing
      AND a.volunteer_id = p_uid
      AND a.role = 'instructor'
      AND a.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_instructor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_instructor(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Eligible instructor joins open event" ON public.event_instructors;
CREATE POLICY "Eligible instructor joins open event" ON public.event_instructors
  FOR INSERT WITH CHECK (
    instructor_id = (SELECT auth.uid())
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND public.is_approved_instructor((SELECT auth.uid()), listing_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('creator', 'kreator')
        AND p.offers_coaching = true
        AND p.coaching_hourly_rate_sek IS NOT NULL
        AND p.coaching_hourly_rate_sek > 0
        AND p.stripe_account_id IS NOT NULL
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
