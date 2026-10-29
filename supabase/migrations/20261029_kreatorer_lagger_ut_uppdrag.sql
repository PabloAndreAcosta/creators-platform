-- Kreatörer får lägga ut uppdrag, inte bara lokaler. Den som håller kvällen är
-- inte alltid lokalen. Håll i synk med GIG_POSTER_ROLES i src/lib/gigs/can-post.ts.
DROP POLICY IF EXISTS "Cleared venue manages own gigs" ON public.gigs;
DROP POLICY IF EXISTS "Cleared arranger manages own gigs" ON public.gigs;
CREATE POLICY "Cleared arranger manages own gigs" ON public.gigs
  FOR ALL
  USING (
    (arranger_id = (SELECT auth.uid()))
    AND is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role IN ('creator', 'kreator', 'venue', 'experience', 'upplevelse')))
  WITH CHECK (
    (arranger_id = (SELECT auth.uid()))
    AND is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role IN ('creator', 'kreator', 'venue', 'experience', 'upplevelse')));
