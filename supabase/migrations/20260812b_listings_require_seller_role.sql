-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX: listings-skrivning kräver SÄLJARROLL (inte bara BankID-clearance)
--
-- Bakgrund: is_bankid_cleared() returnerar TRUE för role='customer' (medvetet, så
-- att köpare inte behöver BankID). Den tidigare listings-policyn gatade bara på
--   auth.uid() = user_id AND is_bankid_cleared(auth.uid())
-- utan rollkontroll. En audience/customer-användare passerade därför clearance och
-- kunde skapa + publicera betalda event och sälja biljetter UTAN att någonsin
-- verifiera identitet med BankID. Motsvarande policyer för gigs och
-- event_instructors har redan en rollkontroll — listings saknade den.
--
-- App-lagret (createEvent m.fl.) skriver via service-role och gatas separat i
-- src/app/app/events/actions.ts (isBankidCleared kräver nu isSeller). Denna
-- policy är försvar-i-djupet för direkta användar-klient-skrivningar (t.ex.
-- is_active/is_public-toggles). Co-organizers administrerar via service-role och
-- påverkas inte.
--
-- Rolluppsättningen matchar SELLER_ROLE_VALUES i src/lib/roles.ts (kanoniska +
-- historiska svenska stavningar) så inga befintliga säljare bryts.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Cleared users manage own listings" ON public.listings;

CREATE POLICY "Cleared sellers manage own listings" ON public.listings
  FOR ALL
  USING (
    (SELECT auth.uid()) = user_id
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('creator', 'kreator', 'venue', 'upplevelse', 'experience')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('creator', 'kreator', 'venue', 'upplevelse', 'experience')
    )
  );
