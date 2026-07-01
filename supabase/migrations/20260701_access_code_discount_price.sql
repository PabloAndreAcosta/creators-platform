-- Anna-feedback (round 2): rabattkoder per event. Utöver gratis team/VIP-koder
-- ska en host kunna skapa en kod som ger ett RABATTERAT pris (t.ex. 333 → 222 kr)
-- i stället för gratis biljett. discount_price = slutpris i kr. NULL = gratis (befintligt).

ALTER TABLE public.event_access_codes
  ADD COLUMN IF NOT EXISTS discount_price integer;

ALTER TABLE public.event_access_codes
  DROP CONSTRAINT IF EXISTS event_access_codes_discount_price_check;
ALTER TABLE public.event_access_codes
  ADD CONSTRAINT event_access_codes_discount_price_check
  CHECK (discount_price IS NULL OR discount_price > 0);

COMMENT ON COLUMN public.event_access_codes.discount_price IS
  'NULL = gratis biljett (team/VIP). Satt (kr) = betald biljett till detta slutpris via Stripe.';

-- Konsumera en användning på id (används av Stripe-webhooken EFTER lyckad betalning
-- för rabattkoder, så att en användning aldrig bränns på en avbruten checkout).
-- Guardad mot max_uses precis som redeem_access_code.
CREATE OR REPLACE FUNCTION public.consume_access_code(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.event_access_codes
  SET used_count = used_count + 1
  WHERE id = p_id
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses);
$$;
