-- Add missing WITH CHECK to write policies (same class as the promo_codes hole).
--
-- A FOR ALL / FOR UPDATE policy with USING but no WITH CHECK enforces the
-- predicate on the EXISTING row only, not the NEW row — so a user can INSERT or
-- rewrite a row (e.g. set blocker_id / from_user / applicant_id to someone else,
-- or move it to another parent) as long as the row they started from passed
-- USING. Adding WITH CHECK equal to USING stops the new row from escaping to a
-- user/parent the caller doesn't control. Recreate each policy with WITH CHECK.

-- user_blocks: FOR ALL, was USING-only.
DROP POLICY IF EXISTS "Users can manage their own blocks" ON public.user_blocks;
CREATE POLICY "Users can manage their own blocks" ON public.user_blocks
  FOR ALL
  USING ((select auth.uid()) = blocker_id)
  WITH CHECK ((select auth.uid()) = blocker_id);

-- buddy_likes: FOR UPDATE, was USING-only.
DROP POLICY IF EXISTS "buddy_likes own update" ON public.buddy_likes;
CREATE POLICY "buddy_likes own update" ON public.buddy_likes
  FOR UPDATE
  USING (auth.uid() = from_user)
  WITH CHECK (auth.uid() = from_user);

-- gig_applications: FOR UPDATE, was USING-only. WITH CHECK mirrors USING so an
-- applicant can't reassign their row to another gig and an arranger can only
-- touch applications on gigs they own. (Column-level status gating is enforced
-- server-side in acceptApplication.)
DROP POLICY IF EXISTS "Update own application or applications to own gig" ON public.gig_applications;
CREATE POLICY "Update own application or applications to own gig" ON public.gig_applications
  FOR UPDATE
  USING (
    (applicant_id = (select auth.uid()))
    OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_applications.gig_id AND g.arranger_id = (select auth.uid()))
  )
  WITH CHECK (
    (applicant_id = (select auth.uid()))
    OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_applications.gig_id AND g.arranger_id = (select auth.uid()))
  );

-- gage_agreements: FOR UPDATE, was USING-only. Prevents reassigning the
-- counterparty; money still only moves on host-pay, which re-verifies.
DROP POLICY IF EXISTS "gage_update_party" ON public.gage_agreements;
CREATE POLICY "gage_update_party" ON public.gage_agreements
  FOR UPDATE
  USING ((host_id = (select auth.uid())) OR (collaborator_user_id = (select auth.uid())))
  WITH CHECK ((host_id = (select auth.uid())) OR (collaborator_user_id = (select auth.uid())));
