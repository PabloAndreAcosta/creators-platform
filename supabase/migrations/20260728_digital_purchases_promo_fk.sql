-- Repoint digital_purchases.creator_promo_id to the promo table it actually names.
--
-- The column was FK'd to auth.users(id), a leftover from when product-checkout
-- stored the creator's user id there. The value is now (correctly) the
-- creator_promo_codes row id, so the FK must point at creator_promo_codes. Safe:
-- digital_purchases has 0 rows, so no existing value violates the new constraint.

ALTER TABLE public.digital_purchases
  DROP CONSTRAINT IF EXISTS digital_purchases_creator_promo_id_fkey;

ALTER TABLE public.digital_purchases
  ADD CONSTRAINT digital_purchases_creator_promo_id_fkey
  FOREIGN KEY (creator_promo_id) REFERENCES public.creator_promo_codes(id) ON DELETE SET NULL;
