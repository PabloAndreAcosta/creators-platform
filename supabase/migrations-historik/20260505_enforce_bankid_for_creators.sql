-- ============================================================
-- Enforce BankID verification for creator/experience commercial actions.
-- Defense-in-depth: even if a creator/experience profile is created
-- without bankid_verified_at (e.g. via direct anon-key API call bypassing
-- the signup UI), it cannot insert/update listings, post gigs, or apply
-- to gigs until BankID verification is recorded.
--
-- Pre-feature users may be grandfathered via bankid_grandfathered_at.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bankid_grandfathered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.bankid_grandfathered_at IS
  'Set for creator/experience users who registered before BankID enforcement (2026-05-05). They retain commercial-action access without re-verifying.';

-- Grandfather existing creator/experience profiles missing bankid_verified_at.
UPDATE public.profiles
SET bankid_grandfathered_at = now()
WHERE role IN ('creator', 'experience')
  AND bankid_verified_at IS NULL
  AND bankid_grandfathered_at IS NULL;

-- ─── BankID gate function ───
-- TRUE if the profile is allowed to perform creator/experience commercial
-- actions. Customers always pass (no BankID required for them).
CREATE OR REPLACE FUNCTION public.is_bankid_cleared(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND (
        p.role = 'customer'
        OR p.bankid_verified_at IS NOT NULL
        OR p.bankid_grandfathered_at IS NOT NULL
      )
  );
$$;

-- ─── LISTINGS: gate insert/update on BankID clearance ──
DROP POLICY IF EXISTS "Users can manage own listings" ON public.listings;

CREATE POLICY "Cleared users manage own listings" ON public.listings
  FOR ALL USING (
    auth.uid() = user_id
    AND public.is_bankid_cleared(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_bankid_cleared(auth.uid())
  );

-- ─── GIGS: arranger must be BankID-cleared experience role ──
DROP POLICY IF EXISTS "Experience role manages own gigs" ON public.gigs;

CREATE POLICY "Cleared experience manages own gigs" ON public.gigs
  FOR ALL USING (
    arranger_id = auth.uid()
    AND public.is_bankid_cleared(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'experience'
    )
  )
  WITH CHECK (
    arranger_id = auth.uid()
    AND public.is_bankid_cleared(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'experience'
    )
  );

-- ─── GIG APPLICATIONS: applicant must be BankID-cleared taxi_dancer ──
DROP POLICY IF EXISTS "Taxi dancer applies" ON public.gig_applications;

CREATE POLICY "Cleared taxi dancer applies" ON public.gig_applications
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid()
    AND public.is_bankid_cleared(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'creator'
        AND p.creator_subcategory = 'taxi_dancer'
    )
  );
